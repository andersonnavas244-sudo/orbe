package com.orbesismos.app;

import android.content.Context;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;

/**
 * SOS: sirena fuerte + linterna parpadeando en código Morse SOS (··· ––– ···).
 * También se usa para la alarma del simulacro (solo sirena).
 */
public final class SosHelper {

    private static volatile boolean running;
    private static Thread sirenThread, torchThread;
    private static int savedVolume = -1;

    private SosHelper() { }

    public static synchronized void start(Context c, boolean torch) {
        stop(c);
        running = true;
        AudioManager am = c.getSystemService(AudioManager.class);
        savedVolume = am.getStreamVolume(AudioManager.STREAM_ALARM);
        am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
        sirenThread = new Thread(SosHelper::siren, "sirena");
        sirenThread.start();
        if (torch) {
            Context app = c.getApplicationContext();
            torchThread = new Thread(() -> blink(app), "linterna");
            torchThread.start();
        }
    }

    public static synchronized void stop(Context c) {
        running = false;
        if (sirenThread != null) sirenThread.interrupt();
        if (torchThread != null) torchThread.interrupt();
        sirenThread = torchThread = null;
        if (savedVolume >= 0) {
            c.getSystemService(AudioManager.class).setStreamVolume(AudioManager.STREAM_ALARM, savedVolume, 0);
            savedVolume = -1;
        }
        setTorch(c.getApplicationContext(), false);
    }

    /** Sirena: tono que sube y baja entre 650 y 1450 Hz, por el canal de alarma (suena aunque esté en silencio). */
    private static void siren() {
        int rate = 22050;
        int buf = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioTrack t = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(Math.max(buf, rate / 5))
                .setTransferMode(AudioTrack.MODE_STREAM).build();
        t.play();
        short[] chunk = new short[rate / 20];
        double phase = 0, time = 0;
        try {
            while (running) {
                for (int i = 0; i < chunk.length; i++) {
                    double sweep = (Math.sin(2 * Math.PI * time / 1.2) + 1) / 2;   // ciclo de 1,2 s
                    double f = 650 + 800 * sweep;
                    phase += 2 * Math.PI * f / rate;
                    chunk[i] = (short) (Math.sin(phase) * 0.9 * Short.MAX_VALUE);
                    time += 1.0 / rate;
                }
                t.write(chunk, 0, chunk.length);
            }
        } catch (Exception ignored) {
        } finally {
            try { t.stop(); } catch (Exception ignored) { }
            t.release();
        }
    }

    private static void blink(Context c) {
        int dot = 250, dash = 750;
        int[] pattern = {dot, dot, dot, dash, dash, dash, dot, dot, dot};
        try {
            while (running) {
                for (int on : pattern) {
                    if (!running) break;
                    setTorch(c, true); Thread.sleep(on);
                    setTorch(c, false); Thread.sleep(dot);
                }
                Thread.sleep(dash * 2);
            }
        } catch (InterruptedException ignored) {
        } finally {
            setTorch(c, false);
        }
    }

    /** Linterna fija (modo apagón). */
    static void setTorch(Context c, boolean on) {
        try {
            CameraManager cm = c.getSystemService(CameraManager.class);
            for (String id : cm.getCameraIdList()) {
                Boolean flash = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (Boolean.TRUE.equals(flash)) { cm.setTorchMode(id, on); return; }
            }
        } catch (Exception ignored) { /* sin linterna */ }
    }
}
