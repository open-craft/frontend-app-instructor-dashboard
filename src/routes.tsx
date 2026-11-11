import { useParams, Navigate } from 'react-router-dom';
import PageNotFound from '@src/components/PageNotFound';
import { useWidgetProps } from './slots/SlotUtils';
import { instructorDashboardRole } from './constants';
import {
  DashboardConfig,
  DashboardConfigProvider,
  DashboardRouteProps,
  useDashboardConfig,
} from './dashboardConfig/DashboardConfigContext';
import { authenticatedLoader } from '@openedx/frontend-base';
import { useEnrollmentAccess } from '@src/courseTeam/data/apiHook';

const EnrollmentAccessGuard = ({ children }: { children: React.ReactNode }) => {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const { useTabsInfo, defaultLandingTabId } = useDashboardConfig();
  const { data, isLoading } = useTabsInfo(courseId);
  const { restricted, isPending } = useEnrollmentAccess(courseId, data?.username);

  if (isLoading || isPending) return null;
  if (restricted) return <Navigate to={`../${defaultLandingTabId}`} replace />;
  return <>{children}</>;
};

const TabContent = () => {
  const { tabId } = useParams<{ tabId: string }>();
  const { defaultTabs, routesSlotId, variantId } = useDashboardConfig();
  const routeWidgets = useWidgetProps(routesSlotId) as DashboardRouteProps[];

  const tabRoutes = [
    ...defaultTabs.filter(
      defaultTab => !routeWidgets.some(slotTab => slotTab.tabId === defaultTab.tabId)
    ),
    ...routeWidgets
  ];

  const foundTab = tabRoutes.find(tab => tab.tabId === tabId);

  if (foundTab && tabId === 'enrollments' && variantId === 'instructorDashboard') {
    return <EnrollmentAccessGuard>{foundTab.content}</EnrollmentAccessGuard>;
  }
  return foundTab ? foundTab.content : <PageNotFound />;
};

const DefaultTabRedirect = () => {
  const { defaultLandingTabId } = useDashboardConfig();
  return <Navigate to={defaultLandingTabId} replace />;
};

const buildDashboardComponent = (Main: React.ComponentType, config: DashboardConfig) => {
  const DashboardRoot = () => (
    <DashboardConfigProvider value={config}>
      <Main />
    </DashboardConfigProvider>
  );
  DashboardRoot.displayName = `DashboardRoot(${config.variantId})`;
  return DashboardRoot;
};

type ConfigsModule = typeof import('./dashboardConfig/configs');

const createDashboardRoute = (
  id: string,
  path: string,
  getConfig: (configs: ConfigsModule) => DashboardConfig,
) => ({
  id,
  path,
  loader: authenticatedLoader,
  handle: { roles: [instructorDashboardRole] },
  async lazy() {
    const [{ default: Main }, configs] = await Promise.all([
      import('./Main'),
      import('./dashboardConfig/configs'),
    ]);
    return { Component: buildDashboardComponent(Main, getConfig(configs)) };
  },
  children: [
    { index: true, element: <DefaultTabRedirect /> },
    { path: ':tabId', element: <TabContent /> },
  ],
});

const routes = [
  createDashboardRoute(
    'org.openedx.frontend.route.instructorDashboard.main',
    'instructor-dashboard/:courseId',
    m => m.instructorDashboardConfig,
  ),
  createDashboardRoute(
    'org.openedx.frontend.route.ccxCoach.main',
    'ccx-coach/:courseId',
    m => m.ccxCoachConfig,
  ),
];

export default routes;
