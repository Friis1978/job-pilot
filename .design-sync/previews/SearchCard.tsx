import { SearchCard } from 'job_pilot';

export function NoHistory() {
  return (
    <SearchCard
      recentSearches={[]}
      defaultLocation=""
    />
  );
}

export function WithRecentSearches() {
  return (
    <SearchCard
      recentSearches={[
        { jobTitle: 'Senior Frontend Engineer', location: 'Copenhagen, Denmark', searchedAt: '2024-06-25T10:00:00Z' },
        { jobTitle: 'TypeScript Developer', location: 'Remote', searchedAt: '2024-06-24T14:30:00Z' },
        { jobTitle: 'React Developer', location: 'Stockholm, Sweden', searchedAt: '2024-06-23T09:00:00Z' },
      ]}
      defaultLocation="Copenhagen, Denmark"
    />
  );
}
