# adc-mail

Cliente de correo de la plataforma ADC (micro-frontend React).

Buzones: entrada, enviados, borradores, spam y papelera. Permite redactar con
editor de texto enriquecido (`adc-mail-composer`), adjuntar archivos a S3,
programar envíos y gestionar el almacenamiento por tier.

- Host de Module Federation, namespace UI `adc-platform`.
- Consume el backend `EmailService` vía `/api/email/*`.
- Subdominio `mail` (devPort 3030).
