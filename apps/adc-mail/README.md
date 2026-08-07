# adc-mail

Cliente de correo de la plataforma ADC (micro-frontend React).

Buzones: entrada, enviados, borradores, spam y papelera. Permite redactar con
editor de texto enriquecido (`adc-mail-composer`), adjuntar archivos a S3,
programar envíos y gestionar el almacenamiento por tier.

Layout: por encima de `lg`, lista y lectura en paralelo; por debajo (mobile o
ventana angosta) la lista ocupa el ancho completo y leer, redactar y previsualizar
adjuntos se abren en `adc-modal size="full"`.

- Host de Module Federation, namespace UI `adc-platform`.
- Consume el backend `EmailService` vía `/api/email/*`.
- Subdominio `mail` (devPort 3030).
