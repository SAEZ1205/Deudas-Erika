package com.saez.susana;
import android.content.*;import android.os.Build;
public class AlarmReceiver extends BroadcastReceiver {public void onReceive(Context c,Intent i){Intent s=new Intent(c,AlarmService.class);s.putExtra("title",i!=null?i.getStringExtra("title"):"Recordatorio");s.putExtra("phase",i!=null?i.getStringExtra("phase"):"ahora");s.putExtra("id",i!=null?i.getLongExtra("id",System.currentTimeMillis()):System.currentTimeMillis());try{if(Build.VERSION.SDK_INT>=26)c.startForegroundService(s);else c.startService(s);}catch(Exception ignored){}}}
