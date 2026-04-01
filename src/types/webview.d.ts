declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        allowpopups?: string;
        webpreferences?: string;
        style?: any;
      }, HTMLElement>;
    }
  }
}

export {};
