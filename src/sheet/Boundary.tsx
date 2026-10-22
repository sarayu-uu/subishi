import { Component, type ComponentChildren } from 'preact';

type Props = { children: ComponentChildren; onReset: () => void };

/** Catches an error inside the sheet (a card with odd data, say) so the rest of the page keeps working. */
export class SheetBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Sheet error:', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div class="oops" role="alert">
        <p>Something went wrong showing this. The rest of the map still works.</p>
        <button type="button" onClick={() => { this.setState({ failed: false }); this.props.onReset(); }}>Back to all homes</button>
      </div>
    );
  }
}
