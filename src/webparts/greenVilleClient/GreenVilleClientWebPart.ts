import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import GreenVilleClient from './components/GreenVilleClient';
import ErrorBoundary from './components/ErrorBoundary';
import { IGreenVilleClientProps } from './components/IGreenVilleClientProps';

export interface IGreenVilleClientWebPartProps {
  description: string;
}

export default class GreenVilleClientWebPart extends BaseClientSideWebPart<IGreenVilleClientWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';

  public render(): void {
    const element: React.ReactElement = React.createElement(
      ErrorBoundary,
      null,
      React.createElement<IGreenVilleClientProps>(
        GreenVilleClient,
        {
          webUrl: this.context.pageContext.web.absoluteUrl
        }
      )
    );

    try {
      ReactDom.render(element, this.domElement);
    } catch (error) {
      console.error('GreenVille Client web part failed before React mounted:', error);
      const message = this._getErrorMessage(error);
      this.domElement.innerHTML = `
        <div role="alert" style="padding:16px;color:#a4262c">
          <strong>GreenVille Client failed to load.</strong>
          <div>${this._escapeHtml(message)}</div>
        </div>`;
    }
  }

  protected onInit(): Promise<void> {
    return super.onInit();
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const { semanticColors } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || '');
      this.domElement.style.setProperty('--link', semanticColors.link || '');
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || '');
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  private _getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  private _escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

}
