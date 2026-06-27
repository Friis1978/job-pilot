import { Navbar } from 'job_pilot';

export function LoggedIn() {
  return (
    <Navbar
      user={{ name: 'Jane Doe', email: 'jane@example.com', avatarUrl: null }}
      hasAccount={true}
      isAdmin={false}
    />
  );
}

export function LoggedOut() {
  return <Navbar />;
}

export function AdminUser() {
  return (
    <Navbar
      user={{ name: 'Admin User', email: 'admin@example.com', avatarUrl: null }}
      hasAccount={true}
      isAdmin={true}
    />
  );
}
