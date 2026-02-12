import { SPHttpClient } from '@microsoft/sp-http';

export interface IGreenVilleClientProps {
  spHttpClient: SPHttpClient;
  siteUrl: string;
}
