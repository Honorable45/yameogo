import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { loadConfig } from '../config/env';

/**
 * Intégration PayGate Global (agrégateur TMoney / Flooz au Togo).
 *
 * Principe de sécurité : une notification reçue (callback) n'est jamais crue sur parole.
 * Le statut est systématiquement revérifié auprès de PayGate (appel serveur à serveur)
 * avant de confirmer un paiement.
 *
 * Le module n'est actif que si PAYGATE_API_KEY est défini. À valider avec la documentation
 * à jour du prestataire et un compte marchand avant la mise en service.
 */
export type PaygateNetwork = 'TMONEY' | 'FLOOZ';

export interface PaygateStatus {
  // 0 : succès, 2 : en cours, 4 : expiré, 6 : annulé
  status: number;
  txReference?: string;
  paymentReference?: string;
  amount?: number;
}

const BASE_URL = 'https://paygateglobal.com/api';

@Injectable()
export class PaygateProvider {
  private readonly logger = new Logger(PaygateProvider.name);
  private readonly apiKey = loadConfig().paygateApiKey;

  get enabled() {
    return Boolean(this.apiKey);
  }

  private assertEnabled() {
    if (!this.apiKey) throw new ServiceUnavailableException("Le paiement mobile en ligne n'est pas disponible.");
  }

  async requestPayment(input: { identifier: string; amount: number; phone: string; network: PaygateNetwork; description: string }) {
    this.assertEnabled();
    const res = await fetch(`${BASE_URL}/v1/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: this.apiKey,
        phone_number: input.phone.replace(/\D/g, '').slice(-8),
        amount: input.amount,
        description: input.description.slice(0, 100),
        identifier: input.identifier,
        network: input.network,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { tx_reference?: string; status?: number };
    if (!res.ok || body.status !== 0) {
      this.logger.warn(`Demande de paiement refusée par PayGate (statut ${body.status ?? res.status}).`);
      throw new ServiceUnavailableException("La demande de paiement n'a pas pu être transmise à l'opérateur. Réessayez ou choisissez un autre mode de paiement.");
    }
    return { txReference: body.tx_reference ?? null };
  }

  async checkStatus(identifier: string): Promise<PaygateStatus> {
    this.assertEnabled();
    const res = await fetch(`${BASE_URL}/v2/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_token: this.apiKey, identifier }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new ServiceUnavailableException('Vérification du paiement momentanément impossible.');
    const body = (await res.json()) as { status: number; tx_reference?: string; payment_reference?: string; amount?: number };
    return { status: Number(body.status), txReference: body.tx_reference, paymentReference: body.payment_reference, amount: body.amount };
  }
}
