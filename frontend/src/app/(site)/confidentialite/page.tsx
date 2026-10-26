import type { Metadata } from 'next';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';
import { LegalLayout } from '@/components/site/legal-layout';

export const metadata: Metadata = { title: 'Politique de confidentialité', alternates: { canonical: '/confidentialite' } };

export default async function PrivacyPage() {
  const s = await serverGet<PublicSettings>('/settings/public', 300);
  const contact = s?.email || s?.phone;
  return (
    <LegalLayout title="Confidentialité">
      <section>
        <h2>Commandes et devis par WhatsApp</h2>
        <p>Les achats et les demandes de devis se font sur WhatsApp : le site prépare un message (article, prix, ou modèle et panne) que vous envoyez vous-même depuis votre téléphone. Le site n’enregistre ni votre numéro ni vos messages ; la conversation relève des conditions de WhatsApp.</p>
      </section>
      <section>
        <h2>Données conservées par la boutique</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Réparation en boutique : coordonnées, informations sur l’appareil et, si nécessaire, son IMEI — chiffré et accessible uniquement au personnel habilité.</li>
          <li>Achats enregistrés en caisse : nom et téléphone si vous les communiquez.</li>
          <li>Avis : notes, commentaire et prénom ou pseudonyme facultatif. Aucun numéro n’est publié.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>Le site n’utilise ni cookie publicitaire ni outil de suivi. Un cookie de session existe uniquement pour l’équipe connectée à l’administration.</p>
      </section>
      <section>
        <h2>Conservation et sécurité</h2>
        <p>Les données sont conservées le temps nécessaire au suivi des commandes, des réparations et des garanties, puis pour la durée imposée par les obligations comptables. L’accès est limité au personnel autorisé et chaque consultation d’une donnée sensible est journalisée.</p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l’accès, la rectification ou la suppression de vos données
          {contact ? <> en nous contactant ({[s?.email, s?.phone].filter(Boolean).join(' ou ')}).</> : ' en vous adressant à la boutique.'}
        </p>
      </section>
    </LegalLayout>
  );
}
