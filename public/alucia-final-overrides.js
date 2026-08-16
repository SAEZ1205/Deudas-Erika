(() => {
  const banners = {
    '500': '/promos/lucia-normal-500.webp',
    '170': '/promos/lucia-discount-170.webp',
    '250': '/promos/lucia-proration-250.webp',
    '280': '/promos/lucia-reconnection-280.webp',
  }

  const callCases = {
    current: 'CASO-602318',
    discount: 'CASO-218217',
    proration: 'CASO-771204',
    reconnection: 'DEMO-RECONNECTION',
    unverified: 'DEMO-UNVERIFIED',
  }

  const handoffCases = {
    unverified: {
      id: 'DEMO-UNVERIFIED',
      clientHash: '#CL-48A253',
      fullName: 'Cliente demo cargo sin evidencia',
      gender: 'female',
      phone: '••••••258',

      reason: 'Cargo no reconocido',

      shortSummary:
        'Se detectó un paquete de 3 GB por 10 días por S/9.99, pero no se pudo confirmar su origen.',

      status: 'pending',

      receipt: 'S7AA-0068423074',
      cycle: '23 may - 22 jun',

      evidence: [
        'Cargo de S/9.99 identificado en Facturación',
        'Paquete de 3 GB por 10 días',
        'No se encontró una orden asociada que permita confirmar el origen',
      ],

      evidenceStatus: 'NONE',

      conversation: [
        {
          role: 'client',
          text: '¿Por qué vino así mi recibo?',
        },
        {
          role: 'lucia',
          text:
            'Encontré un paquete de 3 GB por 10 días por S/9.99 en tu recibo. ' +
            'Lo que no puedo confirmar es cómo se originó ese cargo.',
        },
        {
          role: 'client',
          text: 'Yo nunca pedí eso',
        },
        {
          role: 'lucia',
          text:
            'No tengo información suficiente para confirmar el origen del cargo. ' +
            'Por eso prefiero que un asesor lo revise contigo.',
        },
      ],

      luciaSummary:
        'Se detectó un cargo nuevo de S/9.99 correspondiente a un paquete de 3 GB por 10 días. ' +
        'El cargo aparece en Facturación, pero no existe una orden asociada que permita confirmar cómo se originó. ' +
        'El caso requiere revisión humana.',
    },
  }

  let calling = false

  async function notifyAdvisorFromChat(button) {
    if (calling) return

    calling = true

    const original = button.textContent

    button.disabled = true
    button.textContent = '⏳ Enviando tu caso…'

    try {
      const scenario =
        sessionStorage.getItem('alucia:scenario') || 'current'

      const handoffData = handoffCases[scenario]

      console.log('[LucIA HANDOFF] scenario:', scenario)
      console.log('[LucIA HANDOFF] handoffData:', handoffData)

      if (!handoffData) {
        throw new Error(
          'No existe información suficiente para crear este caso.'
        )
      }

      const handoffResponse = await fetch(
        'http://127.0.0.1:8790/api/handoff',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            ...handoffData,
            createdAt: new Date().toISOString(),
          }),
        }
      )

      const handoffResult = await handoffResponse
        .json()
        .catch(() => ({}))

      console.log(
        '[LucIA HANDOFF] respuesta backend:',
        handoffResult
      )

      if (!handoffResponse.ok || !handoffResult.ok) {
        throw new Error(
          handoffResult.message ||
            'No se pudo enviar el caso al asesor.'
        )
      }

      button.textContent = '✅ Caso enviado al asesor'

      setTimeout(() => {
        button.textContent = '✓ Atención solicitada'
        button.disabled = true
        calling = false
      }, 2500)
    } catch (err) {
      console.error('[LucIA HANDOFF]', err)

      button.textContent = '⚠️ Reintentar'

      setTimeout(() => {
        button.textContent = original
        button.disabled = false
        calling = false
      }, 5000)
    }
  }

  function apply() {
    const chat =
      document.querySelector(
        '.alucia-smart-chat'
      )

    if (chat) {
      const trust =
        chat.querySelector(
          '.trust-strip'
        )

      const trustText =
        '✓ Respuestas basadas en tu recibo'

      if (
        trust &&
        trust.textContent !== trustText
      ) {
        trust.textContent = trustText
      }

      const first =
        chat.querySelector(
          '.alucia-scroll .chat-message:not(.user)'
        )

      if (first) {
        const p =
          first.querySelector('p')

        if (
          p &&
          /Ya cargué la demo|Pregúntame como hablas/i.test(
            p.textContent
          )
        ) {
          p.textContent =
            'Hola, soy LucIA. ¿Qué quieres revisar de tu recibo?'
        }

        const small =
          first.querySelector('small')

        if (
          small &&
          /Escenario activo/i.test(
            small.textContent
          )
        ) {
          small.remove()
        }
      }

      chat
        .querySelectorAll(
          '.alucia-offer-card'
        )
        .forEach((card) => {
          const title =
            card.querySelector('h3')
              ?.textContent || ''

          const img =
            card.querySelector(
              '.alucia-offer-banner'
            )

          if (!img) return

          for (const [gb, src] of Object.entries(
            banners
          )) {
            if (
              title.includes(
                gb + ' GB'
              )
            ) {
              if (
                img.getAttribute(
                  'src'
                ) !== src
              ) {
                img.setAttribute(
                  'src',
                  src
                )
              }

              Object.assign(
                img.style,
                {
                  objectFit: 'contain',
                  objectPosition:
                    'center',
                  width: '100%',
                  height: 'auto',
                  maxHeight: 'none',
                }
              )

              break
            }
          }
        })

      chat
        .querySelectorAll(
          '.alucia-human'
        )
        .forEach((btn) => {
          if (
            btn.dataset.realCallBound
          ) {
            return
          }

          btn.dataset.realCallBound =
            '1'

          btn.textContent = 'Solicitar atención de un asesor'

          btn.addEventListener(
            'click',
            (ev) => {
              ev.preventDefault()
              ev.stopPropagation()

              notifyAdvisorFromChat(
                btn
              )
            },
            true
          )
        })
    }

    document
      .querySelectorAll(
        'button,a,[role="button"]'
      )
      .forEach((el) => {
        const txt = (
          el.textContent || ''
        )
          .trim()
          .toLowerCase()

        if (
          (
            txt.includes(
              'dashboard'
            ) ||
            txt.includes(
              'panel asesor'
            ) ||
            txt.includes(
              'vista asesor'
            )
          ) &&
          !el.dataset
            .advisorBound
        ) {
          el.dataset.advisorBound =
            '1'

          el.addEventListener(
            'click',
            (ev) => {
              ev.preventDefault()
              ev.stopPropagation()

              window.top.location.href =
                '/asesor'
            }
          )
        }
      })
  }

  new MutationObserver(
    apply
  ).observe(
    document.documentElement,
    {
      subtree: true,
      childList: true,
      characterData: true,
    }
  )

  document.addEventListener(
    'DOMContentLoaded',
    apply
  )

  setTimeout(
    apply,
    300
  )
})()