import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import twilio from 'twilio'

import {
  advisorCallCases,
  buildAdvisorCallSummary
} from './advisor-call-data.mjs'

// ---------------------------------------------------------
// Variables de entorno
// ---------------------------------------------------------

async function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    try {
      const text = await readFile(
        resolve(file),
        'utf8'
      )

      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()

        if (
          !line ||
          line.startsWith('#')
        ) {
          continue
        }

        const i = line.indexOf('=')

        if (i < 1) {
          continue
        }

        const key =
          line.slice(0, i).trim()

        const value =
          line.slice(i + 1).trim()

        if (
          value &&
          !process.env[key]
        ) {
          process.env[key] = value
        }
      }
    } catch {
      // Archivo opcional
    }
  }
}

await loadEnv()

// ---------------------------------------------------------
// Configuración
// ---------------------------------------------------------

const port = Number(
  process.env.LUCIA_CALLS_PORT ||
    8790
)

const trialMode =
  /^(1|true|yes|si)$/i.test(
    (
      process.env.TWILIO_TRIAL_MODE ||
      ''
    ).trim()
  )

const TRIAL_VOICE_URL =
  'https://webhooks.twilio.com/v1/Voice/Template/voice_text_to_speech'

// Bandeja temporal de casos derivados.
// Se reinicia cuando se reinicia este servidor.
const handoffCases = new Map()

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type':
      'application/json; charset=utf-8'
  })

  res.end(
    JSON.stringify(body)
  )
}

function maskPhone(phone = '') {
  if (phone.length < 7) {
    return '••••••'
  }

  return `${phone.slice(
    0,
    3
  )}******${phone.slice(-3)}`
}

function escapeXml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isConfigured() {
  return Boolean(
    process.env
      .TWILIO_ACCOUNT_SID &&
      process.env
        .TWILIO_AUTH_TOKEN &&
      process.env
        .TWILIO_FROM_NUMBER &&
      process.env.ADVISOR_PHONE
  )
}

// ---------------------------------------------------------
// Servidor
// ---------------------------------------------------------

http
  .createServer(
    async (req, res) => {
      // CORS
      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      )

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
      )

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,OPTIONS'
      )

      if (
        req.method === 'OPTIONS'
      ) {
        res.writeHead(204)
        return res.end()
      }

      const url = new URL(
        req.url,
        'http://localhost'
      )

      // ---------------------------------------------------
      // Health check de Twilio
      // ---------------------------------------------------

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/api/calls/health'
      ) {
        return json(res, 200, {
          ok: true,
          configured:
            isConfigured(),

          mode: trialMode
            ? 'trial-template'
            : 'custom-summary'
        })
      }

      // ---------------------------------------------------
      // HANDOFF - obtener casos
      // ---------------------------------------------------

      if (
        req.method === 'GET' &&
        url.pathname ===
          '/api/handoff'
      ) {
        const cases =
          Array.from(
            handoffCases.values()
          ).sort(
            (a, b) =>
              new Date(
                b.createdAt
              ).getTime() -
              new Date(
                a.createdAt
              ).getTime()
          )

        return json(res, 200, {
          ok: true,
          cases
        })
      }

      // ---------------------------------------------------
      // HANDOFF - registrar/actualizar caso
      // ---------------------------------------------------

      if (
        req.method === 'POST' &&
        url.pathname ===
          '/api/handoff'
      ) {
        let body = ''

        for await (
          const chunk of req
        ) {
          body += chunk
        }

        try {
          const payload =
            JSON.parse(
              body || '{}'
            )

          const id = String(
            payload.id ||
              payload.caseId ||
              ''
          ).trim()

          if (!id) {
            return json(
              res,
              400,
              {
                ok: false,
                code:
                  'HANDOFF_ID_REQUIRED',
                message:
                  'El caso necesita un identificador.'
              }
            )
          }

          const existing =
            handoffCases.get(id)

          const handoffCase = {
            ...existing,
            ...payload,

            id,

            createdAt:
              payload.createdAt ||
              new Date().toISOString(),

            status:
              payload.status ||
              existing?.status ||
              'pending'
          }

          handoffCases.set(
            id,
            handoffCase
          )

          console.log(
            `[HANDOFF] Caso registrado: ${id}`
          )

          return json(
            res,
            existing ? 200 : 201,
            {
              ok: true,
              created: !existing,
              case: handoffCase
            }
          )
        } catch (error) {
          console.error(
            '[HANDOFF] Error:',
            error?.message ||
              error
          )

          return json(
            res,
            400,
            {
              ok: false,
              code:
                'HANDOFF_INVALID_BODY',
              message:
                'No se pudo registrar el caso.'
            }
          )
        }
      }

      // ---------------------------------------------------
      // A partir de aquí solo aceptamos llamada
      // ---------------------------------------------------

      if (
        req.method !== 'POST' ||
        url.pathname !==
          '/api/calls/summary'
      ) {
        return json(
          res,
          404,
          {
            ok: false,
            error: 'not_found'
          }
        )
      }

      // ---------------------------------------------------
      // Leer body de llamada
      // ---------------------------------------------------

      let body = ''

      for await (
        const chunk of req
      ) {
        body += chunk
      }

      try {
        const {
          caseId = ''
        } = JSON.parse(
          body || '{}'
        )

        const caseData =
          advisorCallCases[
            caseId
          ]

        if (!caseData) {
          return json(
            res,
            404,
            {
              ok: false,
              code:
                'CASE_NOT_FOUND',
              message:
                'No se encontró el caso solicitado.'
            }
          )
        }

        const sid = (
          process.env
            .TWILIO_ACCOUNT_SID ||
          ''
        ).trim()

        const token = (
          process.env
            .TWILIO_AUTH_TOKEN ||
          ''
        ).trim()

        const from = (
          process.env
            .TWILIO_FROM_NUMBER ||
          ''
        ).trim()

        const to = (
          process.env
            .ADVISOR_PHONE ||
          ''
        ).trim()

        if (!isConfigured()) {
          return json(
            res,
            503,
            {
              ok: false,
              code:
                'TWILIO_NOT_CONFIGURED',

              message:
                'Falta Account SID, Auth Token, TWILIO_FROM_NUMBER o ADVISOR_PHONE.'
            }
          )
        }

        console.log(
          `[CALL] Solicitud para ${caseId} (${
            trialMode
              ? 'TRIAL'
              : 'CUSTOM'
          })`
        )

        const client = twilio(
          sid,
          token
        )

        let call

        // -------------------------------------------------
        // TWILIO TRIAL
        // -------------------------------------------------

        if (trialMode) {
          /*
           * En Trial, Create Call restringe los
           * parámetros disponibles.
           *
           * Utilizamos la plantilla oficial de Twilio
           * para que la llamada real pueda realizarse.
           *
           * El resumen personalizado del caso queda
           * disponible en el dashboard del asesor.
           */
          call =
            await client.calls.create(
              {
                to,
                from,
                url: TRIAL_VOICE_URL
              }
            )
        }

        // -------------------------------------------------
        // CUENTA TWILIO ACTUALIZADA
        // -------------------------------------------------

        else {
          const summary =
            buildAdvisorCallSummary(
              caseData
            )

          const twiml =
            `<Response>` +
            `<Say language="es-MX">` +
            `${escapeXml(summary)}` +
            `</Say>` +
            `</Response>`

          call =
            await client.calls.create(
              {
                to,
                from,
                twiml
              }
            )
        }

        console.log(
          `[CALL] Llamada creada ${call.sid}`
        )

        return json(
          res,
          200,
          {
            ok: true,

            callSid:
              call.sid,

            caseId,

            toMasked:
              maskPhone(to),

            mode: trialMode
              ? 'trial-template'
              : 'custom-summary',

            note: trialMode
              ? 'La cuenta Trial realizó la llamada usando la plantilla oficial permitida por Twilio. El resumen completo permanece disponible en el dashboard del asesor.'
              : 'LucIA leerá el resumen dinámico correspondiente al caso.'
          }
        )
      } catch (error) {
        console.error(
          '[CALL] Error:',
          error?.message ||
            error
        )

        return json(
          res,
          500,
          {
            ok: false,
            code:
              'CALL_FAILED',

            message:
              error?.message ||
              'No se pudo iniciar la llamada.'
          }
        )
      }
    }
  )
  .listen(
    port,
    '127.0.0.1',
    () => {
      console.log(
        `LucIA llamadas: http://127.0.0.1:${port}/api/calls/summary`
      )

      console.log(
        `[CALL] Modo: ${
          trialMode
            ? 'TWILIO TRIAL'
            : 'RESUMEN DINÁMICO'
        }`
      )
    }
  )