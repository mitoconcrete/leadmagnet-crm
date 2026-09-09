import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('리드마그넷 CRM API')
    .setVersion('0.1.0')
    .addCookieAuth('sid', { type: 'apiKey', in: 'cookie', name: 'sid' }, 'sid')
    .build();
  return SwaggerModule.createDocument(app, config);
}
