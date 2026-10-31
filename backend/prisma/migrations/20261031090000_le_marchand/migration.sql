-- Changement de boutique : Le Marchand. L'ancien logo téléversé est retiré ; le téléphone, WhatsApp et la position sont remplacés ; les autres coordonnées restent à saisir dans l'administration.
ALTER TABLE "BusinessSettings" ALTER COLUMN "shopName" SET DEFAULT 'Le Marchand';
UPDATE "BusinessSettings"
SET "shopName" = 'Le Marchand', "tagline" = 'Votre repère du numérique.', "logoUrl" = NULL, "phone" = '+22892860675', "whatsapp" = '+22892860675',
    "mapUrl" = 'https://maps.app.goo.gl/eW6p3r8JbyzMeZdU6', "latitude" = 6.2019452, "longitude" = 1.194813, "addressLine" = NULL
WHERE "shopName" IN ('Yameogo Smart Tech', 'YAMEOGO');
