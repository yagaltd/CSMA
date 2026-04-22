import { MetaManagerModuleService } from './services/MetaManagerModuleService.js';

export const manifest = {
    id: 'meta-manager',
    name: 'Meta Manager Module',
    version: '1.0.0',
    description: 'Schema.org and SEO helpers layered on the runtime MetaManager',
    dependencies: [],
    services: ['metaManagerModule'],
    contracts: [],
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    metaManagerModule: MetaManagerModuleService
};

export { starterSchemas } from './schema/starter.js';
export { contentSchemas } from './schema/content.js';
export { commerceSchemas } from './schema/commerce.js';
export { localSchemas } from './schema/local.js';
export { WebSiteSchema } from './schema/core/WebSite.js';
export { WebPageSchema } from './schema/core/WebPage.js';
export { OrganizationSchema } from './schema/core/Organization.js';
export { PersonSchema } from './schema/core/Person.js';
export { ArticleSchema } from './schema/content/Article.js';
export { BreadcrumbListSchema } from './schema/content/BreadcrumbList.js';
export { FAQPageSchema } from './schema/content/FAQPage.js';
export { HowToSchema } from './schema/content/HowTo.js';
export { SoftwareApplicationSchema } from './schema/content/SoftwareApplication.js';
export { ProductSchema } from './schema/commerce/Product.js';
export { LocalBusinessSchema } from './schema/local/LocalBusiness.js';
export { EventSchema } from './schema/local/Event.js';
