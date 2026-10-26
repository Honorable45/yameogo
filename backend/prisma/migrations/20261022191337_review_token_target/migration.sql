-- Un code d'avis concerne exactement un dossier de réparation OU une vente.
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_target_check" CHECK (("repairJobId" IS NULL) <> ("orderId" IS NULL));
