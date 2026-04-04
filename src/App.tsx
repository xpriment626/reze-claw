import { WidgetView } from "./components/widget/WidgetView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { useAppMode } from "./shared/use-app-mode";

export default function App() {
  const { mode, expand, collapse } = useAppMode();

  if (mode === "dashboard") {
    return <DashboardView onCollapse={collapse} />;
  }

  return <WidgetView onExpand={expand} />;
}
