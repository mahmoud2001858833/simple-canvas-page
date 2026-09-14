import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard component caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHardReload = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        const url = new URL(window.location.href);
        url.searchParams.set("_v", Date.now().toString());
        window.location.href = url.toString();
      }
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-6 text-center space-y-4 bg-card rounded-2xl border border-destructive/30 shadow-lg animate-fade-in" dir="rtl">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {this.props.fallbackTitle || "حدث خطأ غير متوقع أثناء عرض هذا القسم"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed font-mono text-xs p-3 bg-muted/60 rounded-xl border border-border">
            {this.state.error?.message || "يرجى المحاولة مرة أخرى أو اختيار قسم آخر من القائمة الجانبية."}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button onClick={this.handleReset} className="gap-2 font-bold">
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة</span>
            </Button>
            <Button variant="outline" onClick={this.handleHardReload} className="gap-2 font-medium">
              <span>تحديث فوري وتطهير الكاش</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
