import { WebSiteSchema } from './core/WebSite.js';
import { WebPageSchema } from './core/WebPage.js';
import { OrganizationSchema } from './core/Organization.js';
import { PersonSchema } from './core/Person.js';
import { ArticleSchema } from './content/Article.js';
import { BreadcrumbListSchema } from './content/BreadcrumbList.js';
import { FAQPageSchema } from './content/FAQPage.js';
import { HowToSchema } from './content/HowTo.js';
import { SoftwareApplicationSchema } from './content/SoftwareApplication.js';
import { ProductSchema } from './commerce/Product.js';

export const starterSchemas = [
    WebSiteSchema,
    WebPageSchema,
    OrganizationSchema,
    PersonSchema,
    ArticleSchema,
    BreadcrumbListSchema,
    FAQPageSchema,
    HowToSchema,
    SoftwareApplicationSchema,
    ProductSchema
];
