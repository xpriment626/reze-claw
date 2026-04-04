import { MemoryRouter } from "react-router-dom";
import { WidgetView } from "./components/widget/WidgetView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { useAppMode } from "./shared/use-app-mode";

export default function App() {
  const { mode, expand, collapse } = useAppMode();

  if (mode === "dashboard") {
    return (
      <MemoryRouter initialEntries={["/agents"]}>
        <DashboardView onCollapse={collapse} />
      </MemoryRouter>
    );
  }

  return <WidgetView onExpand={expand} />;
}
