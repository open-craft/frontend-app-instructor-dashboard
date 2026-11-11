import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addTeamMember, getRoles, getTeamMembers, removeTeamMember } from '@src/courseTeam/data/api';
import { courseTeamQueryKeys } from '@src/courseTeam/data/queryKeys';
import { AddTeamMemberParams, CourseTeamMemberQueryParams } from '@src/courseTeam/types';
import { isForbiddenError } from '@src/data/utils';

export const useTeamMembers = (
  courseId: string,
  params: CourseTeamMemberQueryParams,
  { enabled = true, retry }: { enabled?: boolean, retry?: boolean } = {},
) => (
  useQuery({
    queryKey: courseTeamQueryKeys.byCoursePaginated(courseId, params),
    queryFn: () => getTeamMembers(courseId, params),
    enabled: !!courseId && enabled,
    ...(retry === undefined ? {} : { retry }),
  })
);

const ENROLLMENT_RESTRICTED_ROLES = ['eshe_instructor', 'teaching_assistant'];
const ROLE_LOOKUP_PAGE_SIZE = 50;

// Fails open: only a 403 or a restricted role denies; other errors leave access unrestricted.
export const useEnrollmentAccess = (courseId: string, username?: string) => {
  const options = { enabled: !!username, retry: false };
  const lookups = [
    useTeamMembers(courseId, { page: 0, pageSize: ROLE_LOOKUP_PAGE_SIZE, emailOrUsername: username, role: ENROLLMENT_RESTRICTED_ROLES[0] }, options),
    useTeamMembers(courseId, { page: 0, pageSize: ROLE_LOOKUP_PAGE_SIZE, emailOrUsername: username, role: ENROLLMENT_RESTRICTED_ROLES[1] }, options),
  ];
  const forbidden = lookups.some(({ error }) => isForbiddenError(error));
  const hasRestrictedRole = lookups.some(({ data }) => data?.results?.some(member => member.username === username));
  const isPending = lookups.some(lookup => lookup.isPending && lookup.fetchStatus !== 'idle');
  return { restricted: forbidden || hasRestrictedRole, isPending };
};

export const useRoles = (courseId: string, editableRoles = false) => (
  useQuery({
    queryKey: courseTeamQueryKeys.roles(courseId, editableRoles),
    queryFn: () => getRoles(courseId, editableRoles),
    enabled: !!courseId,
  })
);

export const useAddTeamMember = (courseId: string) => {
  const queryClient = useQueryClient();
  return (useMutation({
    mutationFn: (params: AddTeamMemberParams) => addTeamMember(courseId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseTeamQueryKeys.byCourse(courseId) });
    }
  })
  );
};

export const useRemoveTeamMember = (courseId: string) => {
  const queryClient = useQueryClient();
  return (useMutation({
    mutationFn: ({ identifier, roles }: { identifier: string, roles: string[] }) => removeTeamMember(courseId, identifier, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseTeamQueryKeys.byCourse(courseId) });
    }
  })
  );
};
