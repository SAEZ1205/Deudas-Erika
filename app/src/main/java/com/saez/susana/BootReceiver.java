package com.saez.susana;
import android.content.*;import org.json.*;
public class BootReceiver extends BroadcastReceiver {public void onReceive(Context c,Intent i){JSONArray a=ReminderStore.all(c);for(int n=0;n<a.length();n++)try{JSONObject o=a.getJSONObject(n);long when=o.optLong("when");if(when>System.currentTimeMillis())SmartReminderScheduler.schedule(c,o.optLong("id"),o.optString("title"),when,o.optInt("importance",1));}catch(Exception ignored){}}}
