import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { loadConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, StorageService } from '../storage/storage.service';

class SettingsDto {
  @IsOptional() @IsString() @MaxLength(60) shopName?: string;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string | null;
  @IsOptional() @IsString() @MaxLength(160) heroImageAlt?: string | null;
  @IsOptional() @IsString() @MaxLength(160) repairImageAlt?: string | null;
  @IsOptional() @IsString() @MaxLength(160) phonesImageAlt?: string | null;
  @IsOptional() @IsString() @MaxLength(160) shopImageAlt?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Lien TikTok invalide (https://…).' }) @MaxLength(300) tiktokUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Lien Instagram invalide (https://…).' }) @MaxLength(300) instagramUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Lien Facebook invalide (https://…).' }) @MaxLength(300) facebookUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string | null;
  @IsOptional() @IsString() @MaxLength(120) email?: string | null;
  @IsOptional() @IsString() @MaxLength(200) addressLine?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsString() @MaxLength(80) country?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Le lien de carte doit être une URL https.' })
  @MaxLength(500)
  mapUrl?: string | null;
  @IsOptional() @Transform(({ value }) => (value === null || value === '' ? null : Number(value))) @IsLatitude({ message: 'Latitude invalide.' }) latitude?: number | null;
  @IsOptional() @Transform(({ value }) => (value === null || value === '' ? null : Number(value))) @IsLongitude({ message: 'Longitude invalide.' }) longitude?: number | null;
  @IsOptional() @IsString() @MaxLength(160) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(80) legalForm?: string | null;
  @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(80) taxId?: string | null;
  @IsOptional() @IsString() @MaxLength(120) publicationDirector?: string | null;
  @IsOptional() @IsString() @MaxLength(300) hostingProvider?: string | null;
  @IsOptional() @IsString() @MaxLength(600) repairWarrantyText?: string | null;
  @IsOptional() @IsBoolean() deliveryEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) deliveryFee?: number;
  @IsOptional() @IsString() @MaxLength(300) deliveryArea?: string | null;
  @IsOptional() @IsBoolean() cashOnDeliveryEnabled?: boolean;
  @IsOptional() @IsBoolean() payInStoreEnabled?: boolean;
  @IsOptional() @IsBoolean() mobileMoneyEnabled?: boolean;
}

class OpeningHourDto {
  @IsInt() @Min(1) @Max(7) dayOfWeek: number;
  @IsBoolean() closed: boolean;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide (HH:MM).' }) opensAt?: string | null;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide (HH:MM).' }) closesAt?: string | null;
}

class OpeningHoursDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  days: OpeningHourDto[];
}

class ImageKindDto {
  @IsIn(['logo', 'hero', 'repair', 'phones', 'shop'])
  kind: 'logo' | 'hero' | 'repair' | 'phones' | 'shop';
}

export async function getSettings(prisma: PrismaService) {
  return prisma.businessSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

@Controller('settings')
export class SettingsController {
  private readonly config = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Informations publiques de la boutique (en-tête, pied de page, contact, commande). */
  @Public()
  @Get('public')
  async publicSettings() {
    const [s, hours] = await Promise.all([
      getSettings(this.prisma),
      this.prisma.openingHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    ]);
    const onlineMobileMoney = s.mobileMoneyEnabled && Boolean(this.config.paygateApiKey);
    return {
      shopName: s.shopName,
      // Adresse du site public (WEB_ORIGIN) : l'administration s'en sert pour les QR codes et les liens « Voir sur le site ».
      siteUrl: this.config.webOrigin,
      tagline: s.tagline,
      logoUrl: s.logoUrl,
      heroImageUrl: s.heroImageUrl,
      heroImageAlt: s.heroImageAlt,
      repairImageUrl: s.repairImageUrl,
      repairImageAlt: s.repairImageAlt,
      phonesImageUrl: s.phonesImageUrl,
      phonesImageAlt: s.phonesImageAlt,
      shopImageUrl: s.shopImageUrl,
      shopImageAlt: s.shopImageAlt,
      social: { tiktok: s.tiktokUrl, instagram: s.instagramUrl, facebook: s.facebookUrl },
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email,
      addressLine: s.addressLine,
      city: s.city,
      country: s.country,
      mapUrl: s.mapUrl,
      location: s.latitude !== null && s.longitude !== null ? { latitude: s.latitude, longitude: s.longitude } : null,
      legal: {
        legalName: s.legalName,
        legalForm: s.legalForm,
        registrationNumber: s.registrationNumber,
        taxId: s.taxId,
        publicationDirector: s.publicationDirector,
        hostingProvider: s.hostingProvider,
      },
      repairWarrantyText: s.repairWarrantyText,
      openingHours: hours,
      checkout: {
        deliveryEnabled: s.deliveryEnabled,
        deliveryFee: s.deliveryFee,
        deliveryArea: s.deliveryArea,
        payInStore: s.payInStoreEnabled,
        cashOnDelivery: s.deliveryEnabled && s.cashOnDeliveryEnabled,
        mobileMoney: onlineMobileMoney,
      },
    };
  }

  @Get()
  @RequirePermissions('settings.manage')
  async get() {
    const [settings, hours] = await Promise.all([
      getSettings(this.prisma),
      this.prisma.openingHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    ]);
    return { settings, openingHours: hours, paymentProviderConfigured: Boolean(this.config.paygateApiKey) };
  }

  @Put()
  @RequirePermissions('settings.manage')
  async update(@Body() dto: SettingsDto, @CurrentUser() me: AuthUser) {
    if (dto.mobileMoneyEnabled && !this.config.paygateApiKey) {
      throw new BadRequestException(
        "Le paiement mobile en ligne ne peut pas être activé : aucun prestataire de paiement n'est configuré sur le serveur.",
      );
    }
    const data = Object.fromEntries(
      Object.entries(dto).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
    ) as SettingsDto;
    if (data.shopName === null) delete data.shopName;
    await getSettings(this.prisma);
    const settings = await this.prisma.businessSettings.update({ where: { id: 1 }, data });
    await this.audit.log({ userId: me.id, action: 'settings.update', entity: 'BusinessSettings', entityId: '1', summary: 'Paramètres de la boutique modifiés', details: { fields: Object.keys(dto) } });
    return settings;
  }

  @Put('opening-hours')
  @RequirePermissions('settings.manage')
  async openingHours(@Body() dto: OpeningHoursDto) {
    for (const d of dto.days) {
      if (!d.closed && (!d.opensAt || !d.closesAt || d.opensAt >= d.closesAt)) {
        throw new BadRequestException("Horaires invalides : l'heure d'ouverture doit précéder l'heure de fermeture.");
      }
    }
    await this.prisma.$transaction(
      dto.days.map((d) =>
        this.prisma.openingHour.upsert({
          where: { dayOfWeek: d.dayOfWeek },
          update: { closed: d.closed, opensAt: d.closed ? null : d.opensAt, closesAt: d.closed ? null : d.closesAt },
          create: { dayOfWeek: d.dayOfWeek, closed: d.closed, opensAt: d.closed ? null : d.opensAt, closesAt: d.closed ? null : d.closesAt },
        }),
      ),
    );
    return this.prisma.openingHour.findMany({ orderBy: { dayOfWeek: 'asc' } });
  }

  /** Logo ou photo d'accueil. */
  @Post('image')
  @RequirePermissions('settings.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async image(@UploadedFile() file: Express.Multer.File, @Body() dto: ImageKindDto, @CurrentUser() me: AuthUser) {
    const stored = await this.storage.savePublicImage(file?.buffer, 'site');
    const url = this.storage.publicUrl(stored.key);
    const settings = await this.prisma.businessSettings.update({
      where: { id: 1 },
      data: { logo: { logoUrl: url }, hero: { heroImageUrl: url }, repair: { repairImageUrl: url }, phones: { phonesImageUrl: url }, shop: { shopImageUrl: url } }[dto.kind],
    });
    await this.audit.log({ userId: me.id, action: 'settings.image', entity: 'BusinessSettings', entityId: '1', summary: { logo: 'Logo remplacé', hero: "Photo d'accueil remplacée", repair: 'Photo « réparation » remplacée', phones: 'Photo « téléphones » remplacée', shop: 'Photo de la boutique remplacée' }[dto.kind] });
    return settings;
  }
}

@Module({ controllers: [SettingsController] })
export class SettingsModule {}
