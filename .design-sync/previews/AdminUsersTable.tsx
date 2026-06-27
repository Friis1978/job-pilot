import { AdminUsersTable } from 'job_pilot';

const SAMPLE_USERS = [
  { id: 'user-1', email: 'alice@example.com', full_name: 'Alice Johnson', approval_status: 'approved' as const, created_at: '2024-05-01T10:00:00Z' },
  { id: 'user-2', email: 'bob@example.com', full_name: 'Bob Smith', approval_status: 'pending' as const, created_at: '2024-06-20T14:00:00Z' },
  { id: 'user-3', email: 'carol@example.com', full_name: 'Carol Williams', approval_status: 'pending' as const, created_at: '2024-06-25T09:00:00Z' },
  { id: 'user-4', email: 'dave@example.com', full_name: null, approval_status: 'rejected' as const, created_at: '2024-06-10T11:00:00Z' },
  { id: 'user-5', email: 'eve@example.com', full_name: 'Eve Martinez', approval_status: 'approved' as const, created_at: '2024-04-15T08:00:00Z' },
];

export function WithUsers() {
  return <AdminUsersTable users={SAMPLE_USERS} />;
}

export function Empty() {
  return <AdminUsersTable users={[]} />;
}

export function PendingOnly() {
  return (
    <AdminUsersTable
      users={[
        { id: 'user-2', email: 'bob@example.com', full_name: 'Bob Smith', approval_status: 'pending', created_at: '2024-06-20T14:00:00Z' },
        { id: 'user-3', email: 'carol@example.com', full_name: 'Carol Williams', approval_status: 'pending', created_at: '2024-06-25T09:00:00Z' },
      ]}
    />
  );
}
