package com.orbebiblia.app;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;
import java.util.function.Consumer;

/** Lectura en voz alta con la voz en español del teléfono (sin internet si la voz está descargada). */
public final class Speech {
    private TextToSpeech tts;
    private boolean ready;
    private String pendingText;
    private float rate = 0.95f;
    private final Consumer<String> onEvent;   // "start" | "done" | "error"

    public Speech(Context c, Consumer<String> onEvent) {
        this.onEvent = onEvent;
        tts = new TextToSpeech(c.getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS) { onEvent.accept("error"); return; }
            Locale es = Locale.forLanguageTag("es-419");
            if (tts.isLanguageAvailable(es) < TextToSpeech.LANG_AVAILABLE) es = Locale.forLanguageTag("es");
            tts.setLanguage(es);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { onEvent.accept("start"); }
                @Override public void onDone(String id) { if ("fin".equals(id)) onEvent.accept("done"); }
                @Override public void onError(String id) { onEvent.accept("error"); }
            });
            ready = true;
            if (pendingText != null) { speak(pendingText); pendingText = null; }
        });
    }

    public void setRate(float r) { rate = Math.max(0.6f, Math.min(1.6f, r)); }

    /** Lee el texto; los párrafos largos se parten para que la voz no se corte. */
    public void speak(String text) {
        if (!ready) { pendingText = text; return; }
        tts.stop();
        tts.setSpeechRate(rate);
        String[] parts = text.split("(?<=[.;:?!])\\s+");
        StringBuilder chunk = new StringBuilder();
        int k = 0;
        for (int i = 0; i < parts.length; i++) {
            if (chunk.length() + parts[i].length() > 900 && chunk.length() > 0) {
                tts.speak(chunk.toString(), k == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, new Bundle(), "p" + k++);
                chunk.setLength(0);
            }
            chunk.append(parts[i]).append(' ');
        }
        tts.speak(chunk.toString(), k == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, new Bundle(), "fin");
    }

    public void stop() { if (tts != null) tts.stop(); }

    public void shutdown() { if (tts != null) { tts.stop(); tts.shutdown(); tts = null; } }
}
