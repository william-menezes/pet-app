/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { unregisterServiceWorkers } from './app/core/pwa/unregister-service-workers';

// O Faro não usa service worker: limpa o que a versão antiga deixou no aparelho (research §R12).
void unregisterServiceWorkers();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
