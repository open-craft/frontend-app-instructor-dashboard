import { render, screen, waitFor } from '@testing-library/react';
import InstructorNav from './InstructorNav';
import { useParams } from 'react-router-dom';
import { useCourseInfo } from '@src/data/apiHook';
import { useAlert } from '@src/providers/AlertProvider';
import { useWidgetProps } from '../slots/SlotUtils';
import { useEnrollmentAccess } from '@src/courseTeam/data/apiHook';
import { DashboardConfigProvider } from '@src/dashboardConfig/DashboardConfigContext';
import { instructorDashboardConfig } from '@src/dashboardConfig/configs';
import userEvent from '@testing-library/user-event';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children, ...props }: any) => (
    <a href={to} data-testid="react-router-link" {...props} role="button">
      {children}
    </a>
  ),
}));

jest.mock('@src/data/apiHook', () => ({
  useCourseInfo: jest.fn(),
}));
jest.mock('@src/courseTeam/data/apiHook', () => ({
  useEnrollmentAccess: jest.fn(),
}));
jest.mock('@src/providers/AlertProvider', () => ({
  useAlert: jest.fn(),
}));
jest.mock('@src/providers/AccessErrorProvider', () => ({
  useAccessError: jest.fn(() => ({
    clearError: jest.fn(),
    errorType: null,
  })),
}));
jest.mock('../slots/SlotUtils', () => ({
  useWidgetProps: jest.fn(),
}));

const mockClearAlerts = jest.fn();

const renderNav = () => render(
  <DashboardConfigProvider value={instructorDashboardConfig}>
    <InstructorNav />
  </DashboardConfigProvider>
);

describe('InstructorNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAlert as jest.Mock).mockReturnValue({ clearAlerts: mockClearAlerts });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ restricted: false, isPending: false });
  });

  it('renders loading skeleton when loading', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({ data: null, isLoading: true });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();
    const skeleton = document.querySelector('span[aria-busy="true"]');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.firstChild).toHaveClass('react-loading-skeleton lead');
  });

  it('renders nothing if there are no tabs', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({ data: { tabs: [] }, isLoading: false });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    const { container } = renderNav();
    expect(container.firstChild).toBeNull();
  });

  it('renders tabs from API and slot, sorted by sortOrder', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course', tabId: 'tab2' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: {
        tabs: [
          { tabId: 'tab1', url: '/tab1', title: 'Tab 1', sortOrder: 2 },
          { tabId: 'tab2', url: '/tab2', title: 'Tab 2', sortOrder: 1 },
        ],
      },
      isLoading: false,
    });
    (useWidgetProps as jest.Mock).mockReturnValue([
      { tabId: 'tab3', url: '/tab3', title: 'Tab 3', sortOrder: 3 },
    ]);

    renderNav();
    const tabLinks = screen.getAllByRole('button');
    expect(tabLinks).toHaveLength(4);
    expect(tabLinks[0]).toHaveAttribute('aria-label', 'Toggle navigation');
    expect(tabLinks[1]).toHaveTextContent('Tab 2');
    expect(tabLinks[2]).toHaveTextContent('Tab 1');
    expect(tabLinks[3]).toHaveTextContent('Tab 3');
  });

  it('hides enrollments for a restricted role', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { username: 'testuser', tabs: [{ tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 }] },
      isLoading: false,
    });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ restricted: true });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();

    expect(screen.queryByText('Enrollments')).not.toBeInTheDocument();
  });

  it('keeps enrollments visible for other roles', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { username: 'testuser', tabs: [{ tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 }] },
      isLoading: false,
    });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();

    expect(screen.getByText('Enrollments')).toBeInTheDocument();
  });

  it('hides enrollments but keeps course team visible when the team lookup is forbidden', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: {
        username: 'testuser',
        tabs: [
          { tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 },
          { tabId: 'course_team', url: '/course_team', title: 'Course Team', sortOrder: 2 },
        ],
      },
      isLoading: false,
    });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ restricted: true, error: { response: { status: 403 } } });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();

    expect(screen.queryByText('Enrollments')).not.toBeInTheDocument();
    expect(screen.getByText('Course Team')).toBeInTheDocument();
  });

  it('keeps enrollments visible when the team lookup fails for another reason', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { username: 'testuser', tabs: [{ tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 }] },
      isLoading: false,
    });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ restricted: false, error: { response: { status: 500 } } });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();

    expect(screen.getByText('Enrollments')).toBeInTheDocument();
  });

  it('hides enrollments until the lookup settles', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { username: 'testuser', tabs: [
        { tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 },
        { tabId: 'course_team', url: '/course_team', title: 'Course Team', sortOrder: 2 },
      ] },
      isLoading: false,
    });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ isPending: true });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    const { rerender } = renderNav();
    expect(screen.queryByText('Enrollments')).not.toBeInTheDocument();
    expect(screen.getByText('Course Team')).toBeInTheDocument();

    (useEnrollmentAccess as jest.Mock).mockReturnValue({ isPending: false, restricted: false });
    rerender(<DashboardConfigProvider value={instructorDashboardConfig}><InstructorNav /></DashboardConfigProvider>);
    expect(screen.getByText('Enrollments')).toBeInTheDocument();
  });

  it('keeps CCX enrollments visible without instructor role data', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { tabs: [{ tabId: 'enrollments', url: '/enrollments', title: 'Enrollments', sortOrder: 1 }] },
      isLoading: false,
    });
    (useEnrollmentAccess as jest.Mock).mockReturnValue({ isPending: true });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    render(
      <DashboardConfigProvider value={{ ...instructorDashboardConfig, variantId: 'ccxCoach' }}>
        <InstructorNav />
      </DashboardConfigProvider>
    );

    expect(screen.getByText('Enrollments')).toBeInTheDocument();
  });

  it('does not render slot tabs without tabId or title', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course', tabId: '' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: { tabs: [] },
      isLoading: false,
    });
    (useWidgetProps as jest.Mock).mockReturnValue([
      { tabId: '', url: '/tab4', title: 'No ID', sortOrder: 4 },
      { tabId: 'tab5', url: '/tab5', title: '', sortOrder: 5 },
      { tabId: 'tab6', url: '/tab6', title: 'Tab 6', sortOrder: 6 },
    ]);

    renderNav();
    expect(screen.getByText('Tab 6')).toBeInTheDocument();
    expect(screen.queryByText('No ID')).not.toBeInTheDocument();
  });

  it('calls clearAlerts when a tab is selected', async () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course', tabId: 'tab1' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: {
        tabs: [
          { tabId: 'tab1', url: '/tab1', title: 'Tab 1', sortOrder: 1 },
        ],
      },
      isLoading: false,
    });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();
    const user = userEvent.setup();
    const tabLink = screen.getByText('Tab 1');
    await user.click(tabLink);
    expect(mockClearAlerts).toHaveBeenCalled();
  });

  it('marks the correct tab as active', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course', tabId: 'tab2' });
    (useCourseInfo as jest.Mock).mockReturnValue({
      data: {
        tabs: [
          { tabId: 'tab1', url: '/tab1', title: 'Tab 1', sortOrder: 1 },
          { tabId: 'tab2', url: '/tab2', title: 'Tab 2', sortOrder: 2 },
        ],
      },
      isLoading: false,
    });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    renderNav();
    waitFor(() => {
      const tab2Link = screen.getByText('Tab 2');
      expect(tab2Link.closest('a')).toHaveAttribute('aria-current', 'page');
    });
  });

  it('throws a descriptive error when rendered without DashboardConfigProvider', () => {
    (useParams as jest.Mock).mockReturnValue({ courseId: 'course-v1:edX+DemoX+Demo_Course' });
    (useCourseInfo as jest.Mock).mockReturnValue({ data: null, isLoading: true });
    (useWidgetProps as jest.Mock).mockReturnValue([]);

    // Silence expected React error boundary logging for this render.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<InstructorNav />)).toThrow(
      'useDashboardConfig must be used within a DashboardConfigProvider'
    );

    consoleErrorSpy.mockRestore();
  });

  describe('Simplified navigation type detection', () => {
    const courseId = 'course-v1:edX+DemoX+Demo_Course';

    beforeEach(() => {
      (useParams as jest.Mock).mockReturnValue({ courseId, tabId: 'tab1' });
      (useCourseInfo as jest.Mock).mockReturnValue({
        data: { tabs: [] },
        isLoading: false,
      });
    });

    it('uses internal navigation for URLs starting with "/"', () => {
      (useWidgetProps as jest.Mock).mockReturnValue([
        { tabId: 'tab1', url: '/instructor-dashboard/course123/course_info', title: 'Course Info', sortOrder: 1 },
        { tabId: 'tab2', url: '/courses/course123/courseware', title: 'Courseware', sortOrder: 2 },
        { tabId: 'tab3', url: '/authoring/course123', title: 'Authoring', sortOrder: 3 },
        { tabId: 'tab4', url: '/admin/dashboard', title: 'Admin', sortOrder: 4 },
      ]);

      renderNav();

      const courseInfoLink = screen.getByText('Course Info');
      const coursewareLink = screen.getByText('Courseware');
      const authoringLink = screen.getByText('Authoring');
      const adminLink = screen.getByText('Admin');

      // All URLs starting with "/" should use React Router Link (internal navigation)
      // Our mock Link component has role="button", so we can check for that to confirm it's using our internal navigation
      expect(courseInfoLink).toHaveAttribute('role', 'button');
      expect(coursewareLink).toHaveAttribute('role', 'button');
      expect(authoringLink).toHaveAttribute('role', 'button');
      expect(adminLink).toHaveAttribute('role', 'button');

      // Verify the links are accessible and clickable
      expect(courseInfoLink).toBeInTheDocument();
      expect(coursewareLink).toBeInTheDocument();
      expect(authoringLink).toBeInTheDocument();
      expect(adminLink).toBeInTheDocument();
    });

    it('uses external navigation for URLs NOT starting with "/"', () => {
      (useWidgetProps as jest.Mock).mockReturnValue([
        { tabId: 'tab1', url: 'https://external.edx.org/courses', title: 'External Courses', sortOrder: 1 },
        { tabId: 'tab2', url: 'http://learning.edx.org', title: 'Learning', sortOrder: 2 },
        { tabId: 'tab3', url: 'course_info', title: 'Relative Tab', sortOrder: 3 },
        { tabId: 'tab4', url: 'mailto:support@edx.org', title: 'Contact', sortOrder: 4 },
      ]);

      renderNav();

      const externalLink = screen.getByText('External Courses');
      const learningLink = screen.getByText('Learning');
      const relativeLink = screen.getByText('Relative Tab');
      const contactLink = screen.getByText('Contact');

      // All URLs NOT starting with "/" should use anchor tags (external navigation)
      // Our mock Link component has role="button", so if it doesn't have that, it's an external link
      expect(externalLink.closest('a')).not.toHaveAttribute('role', 'button');
      expect(learningLink.closest('a')).not.toHaveAttribute('role', 'button');
      expect(relativeLink.closest('a')).not.toHaveAttribute('role', 'button');
      expect(contactLink.closest('a')).not.toHaveAttribute('role', 'button');

      // Verify the links are accessible and clickable
      expect(externalLink).toBeInTheDocument();
      expect(learningLink).toBeInTheDocument();
      expect(relativeLink).toBeInTheDocument();
      expect(contactLink).toBeInTheDocument();
    });

    it('handles mixed internal and external URLs in same navigation', () => {
      (useWidgetProps as jest.Mock).mockReturnValue([
        { tabId: 'tab1', url: '/internal/path', title: 'Internal', sortOrder: 1 },
        { tabId: 'tab2', url: 'external-relative', title: 'External', sortOrder: 2 },
        { tabId: 'tab3', url: '/another/internal', title: 'Another Internal', sortOrder: 3 },
        { tabId: 'tab4', url: 'https://example.com', title: 'Absolute External', sortOrder: 4 },
      ]);

      renderNav();

      const internalLink = screen.getByText('Internal');
      const externalLink = screen.getByText('External');
      const anotherInternalLink = screen.getByText('Another Internal');
      const absoluteExternalLink = screen.getByText('Absolute External');

      // All links should be present and clickable regardless of navigation type
      expect(internalLink.closest('a')).toHaveAttribute('role', 'button');
      expect(externalLink.closest('a')).not.toHaveAttribute('role', 'button');
      expect(anotherInternalLink.closest('a')).toHaveAttribute('role', 'button');
      expect(absoluteExternalLink.closest('a')).not.toHaveAttribute('role', 'button');

      // Verify the links are accessible
      expect(internalLink).toBeInTheDocument();
      expect(externalLink).toBeInTheDocument();
      expect(anotherInternalLink).toBeInTheDocument();
      expect(absoluteExternalLink).toBeInTheDocument();
    });

    it('maintains clearAlerts functionality for both navigation types', async () => {
      (useWidgetProps as jest.Mock).mockReturnValue([
        { tabId: 'tab1', url: '/internal', title: 'Internal Tab', sortOrder: 1 },
        { tabId: 'tab2', url: 'external', title: 'External Tab', sortOrder: 2 },
      ]);

      renderNav();
      const user = userEvent.setup();

      const internalTab = screen.getByText('Internal Tab');
      const externalTab = screen.getByText('External Tab');

      // Click internal navigation tab
      await user.click(internalTab);
      expect(mockClearAlerts).toHaveBeenCalled();

      mockClearAlerts.mockClear();

      // Click external navigation tab
      await user.click(externalTab);
      expect(mockClearAlerts).toHaveBeenCalled();
    });
  });
});
