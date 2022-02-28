
import { InteractionState } from '@pact-foundation/pact';
import * as pact from './pact/alm-app-publish-service.json'
import * as OpenApiValidator from 'express-openapi-validator';
import express from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import { Request, Response } from 'express';
import http from 'http';
import { environment } from './environment';

export async function main() {

  const app = express();

  app.use(express.json());
  app.use(express.text());
  app.use(express.urlencoded({ extended: false }));

  app.use(
    OpenApiValidator.middleware({
      apiSpec: './swagger/publish-service-swagger.json',
      validateRequests: true,
      validateResponses: true
    }),
  );

  const interactions: InteractionState[] = pact.interactions as InteractionState[];

  for (let i = 0; i < interactions.length; i++) {
    const interaction = interactions[i];

    const given = interaction.providerState ?? (interaction as any).providerStates[0].name;
    const path = interaction.request?.path as string;
    console.log('Mocking interaction: ' + `${interaction.description} given ${given}`);
    console.log({ path })

    if (interaction.request?.method === 'POST') {
      app.post(path, mockCallback(interaction))
    } else {
      app.get(path, mockCallback(interaction))
    }
  }

  app.use((err: any, req: any, res: any, next: any) => {
    // format error
    console.log('Error')
    console.log(err.errors)
    res.status(500).json({
      message: err.message,
      errors: err.errors,
    });
  });

  const server = http.createServer(app).listen(environment.port);

  for (let i = 0; i < interactions.length; i++) {
    const interaction = interactions[i];
    await testInteraction(interaction);
  }
  server.close();
}

function mockCallback(interaction: InteractionState) {
  return (req: Request, res: Response, next: any) => {
    const response = interaction.response;
    const responseHeaders = (response?.headers || {}) as { [name: string]: string };
    res.status(response?.status || 500);
    Object.keys(responseHeaders).forEach(key => {
      res.setHeader(key, responseHeaders[key]);
    })
    res.json(response?.body ?? {});
  }
}

async function testInteraction(interaction: InteractionState) {
  return new Promise(async (res: any, rej: any) => {
    const path = interaction.request?.path as string;
    const url = `${environment.url}:${environment.port}${path}`;
    const headers = interaction.request?.headers as {
      [name: string]: string;
    }
    const config: AxiosRequestConfig = {
      headers: headers,
      validateStatus: (code) => code !== 500 // only throw exception if response is 500
    }

    const given = interaction.providerState ?? (interaction as any).providerStates[0].name;
    console.log(`Testing interaction: ${interaction.description} given ${given}`);
    console.log(`${interaction.request?.method} ${path}`);

    try {
      if (interaction.request?.method === 'POST') {
        await axios.post(url, interaction.request.body, config)
      } else {
        await axios.get(url, config);
      }
      console.log('Interaction passed!\n');
    } catch (err: unknown) {
      console.log('Interaction failed!\n');
    }
    res();
  })
}

main();
