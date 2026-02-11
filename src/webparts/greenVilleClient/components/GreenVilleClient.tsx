import * as React from 'react';
import styles from './GreenVilleClient.module.scss';
import type { IGreenVilleClientProps } from './IGreenVilleClientProps';

export default class GreenVilleClient extends React.Component<IGreenVilleClientProps> {
  public render(): React.ReactElement<IGreenVilleClientProps> {
    const {
    } = this.props;

    return (
      <>
      Hello GreenVille</>
    );
  }
}
