package com.orbeespacio.app;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.Collections;
import java.util.List;

/**
 * Suscripción mensual "Premium sin anuncios" con Google Play Billing.
 * La suscripción debe existir en Play Console (Monetizar → Suscripciones) con el id
 * {@link AdsConfig#PREMIUM_PRODUCT_ID} y un plan base mensual. Solo funciona con la app
 * instalada desde Google Play (o en prueba interna con cuentas de prueba de licencias).
 * Si la suscripción se cancela o vence, los anuncios vuelven en el siguiente inicio.
 */
public class BillingManager implements PurchasesUpdatedListener {

    public interface Callback {
        void onPremium(boolean premium, String price);
        void onMessage(String msg);
    }

    private final Activity activity;
    private final Callback cb;
    private BillingClient client;
    private ProductDetails product;
    private String offerToken;
    private String price = AdsConfig.PREMIUM_FALLBACK_PRICE;

    public BillingManager(Activity activity, Callback cb) {
        this.activity = activity;
        this.cb = cb;
    }

    public void start() {
        cb.onPremium(StationStore.isPremium(activity), price);
        client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryProduct();
                restore();
            }

            @Override
            public void onBillingServiceDisconnected() { /* se reintenta en el próximo inicio */ }
        });
    }

    private void queryProduct() {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(AdsConfig.PREMIUM_PRODUCT_ID)
                        .setProductType(BillingClient.ProductType.SUBS).build()))
                .build();
        client.queryProductDetailsAsync(params, (r, list) -> {
            if (list == null || list.isEmpty()) return;
            product = list.get(0);
            List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) return;
            ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
            offerToken = offer.getOfferToken();
            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
            if (!phases.isEmpty()) {
                // La última fase es el precio normal (las anteriores pueden ser pruebas gratis).
                price = phases.get(phases.size() - 1).getFormattedPrice() + "/mes";
            }
            cb.onPremium(StationStore.isPremium(activity), price);
        });
    }

    /** Comprueba si la suscripción sigue activa (también tras reinstalar o cambiar de teléfono). */
    private void restore() {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                    boolean active = false;
                    for (Purchase p : purchases) active |= handle(p);
                    StationStore.setPremium(activity, active);
                    cb.onPremium(active, price);
                });
    }

    public void buy() {
        if (client == null || !client.isReady() || product == null || offerToken == null) {
            cb.onMessage("La suscripción estará disponible cuando la app se instale desde Google Play.");
            return;
        }
        BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(product)
                                .setOfferToken(offerToken)
                                .build()))
                .build();
        client.launchBillingFlow(activity, params);
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (handle(p)) {
                    StationStore.setPremium(activity, true);
                    cb.onPremium(true, price);
                    cb.onMessage("¡Gracias! Premium activado: ya no verás anuncios.");
                }
            }
        } else if (r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            restore();
        }
    }

    /** Devuelve true si es la suscripción Premium y está pagada; la confirma si hace falta. */
    private boolean handle(Purchase p) {
        if (!p.getProducts().contains(AdsConfig.PREMIUM_PRODUCT_ID)) return false;
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return false;
        if (!p.isAcknowledged()) {
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(p.getPurchaseToken()).build(), res -> { });
        }
        return true;
    }

    /** Página de Google Play donde el usuario cancela o cambia su suscripción. */
    public String manageUrl() {
        return "https://play.google.com/store/account/subscriptions?sku=" + AdsConfig.PREMIUM_PRODUCT_ID
                + "&package=" + activity.getPackageName();
    }

    public void end() {
        if (client != null) client.endConnection();
    }
}
