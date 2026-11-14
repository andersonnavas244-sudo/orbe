package com.orbesismos.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/** Lee en voz alta la alarma ("Sismo de magnitud 5 a 120 kilómetros de Bogotá"), útil para personas mayores. */
public final class Speaker {

    private Speaker() { }

    public static void say(Context ctx, String text) {
        Context c = ctx.getApplicationContext();
        final TextToSpeech[] holder = new TextToSpeech[1];
        holder[0] = new TextToSpeech(c, status -> {
            TextToSpeech tts = holder[0];
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(new Locale("es", "419"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(new Locale("es"));
            tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            tts.setSpeechRate(0.92f);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { tts.shutdown(); }
                @Override public void onError(String id) { tts.shutdown(); }
            });
            // Se repite dos veces, con una pausa, por si no se oyó la primera
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "a1");
            tts.playSilentUtterance(1200, TextToSpeech.QUEUE_ADD, "p");
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, "a2");
        });
    }
}
