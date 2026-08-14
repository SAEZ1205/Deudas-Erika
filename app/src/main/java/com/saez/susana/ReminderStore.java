package com.saez.susana;
import android.content.Context;import org.json.*;import java.text.SimpleDateFormat;import java.util.*;
public final class ReminderStore {
 private static final String KEY="reminders"; private ReminderStore(){}
 public static JSONArray all(Context c){try{return new JSONArray(c.getSharedPreferences("susana",0).getString(KEY,"[]"));}catch(Exception e){return new JSONArray();}}
 public static void add(Context c,long id,String title,long when,int imp){try{JSONArray a=all(c);JSONObject o=new JSONObject();o.put("id",id);o.put("title",title);o.put("when",when);o.put("importance",imp);a.put(o);c.getSharedPreferences("susana",0).edit().putString(KEY,a.toString()).apply();}catch(Exception ignored){}}
 public static int count(Context c){return all(c).length();}
 public static String summary(Context c){JSONArray a=all(c);StringBuilder s=new StringBuilder();SimpleDateFormat f=new SimpleDateFormat("dd/MM · HH:mm",Locale.getDefault());for(int i=0;i<a.length();i++)try{JSONObject o=a.getJSONObject(i);s.append("• ").append(o.optString("title")).append("\n  ").append(f.format(new Date(o.optLong("when"))));if(o.optInt("importance",1)>=3)s.append(" · importante");s.append("\n\n");}catch(Exception ignored){}return s.length()==0?"Aún no tienes recordatorios. Puedes decir: ‘Mamita, recuérdame mi cita en EsSalud en una semana a las 9 pm’.":s.toString();}
}
