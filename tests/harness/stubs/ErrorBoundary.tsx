/*
 * Harness stub: @components/ErrorBoundary
 */

import * as React from "react";

export interface ErrorBoundaryProps {
    noop?: boolean;
    children?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, { error: Error | null; }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    render() {
        if (this.state.error) {
            return this.props.noop ? null : <div data-error-boundary="">{String(this.state.error)}</div>;
        }

        return this.props.children ?? null;
    }
}

export const wrap = (Component: React.ComponentType<any>, props?: Omit<ErrorBoundaryProps, "children">) => {
    const Wrapped: React.FC<any> = (componentProps: any) => (
        <ErrorBoundary {...props}>
            <Component {...componentProps} />
        </ErrorBoundary>
    );
    Wrapped.displayName = `ErrorBoundary(${Component.displayName ?? Component.name ?? "Component"})`;
    return Wrapped;
};

(ErrorBoundary as any).wrap = wrap;

export default ErrorBoundary;
