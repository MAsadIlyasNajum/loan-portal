export interface ListOptions {
  readonly status?: string;
}

export function listApplications(): Promise<never> {
  throw new Error('API not mocked');
}

export function getApplication(): Promise<never> {
  throw new Error('API not mocked');
}

export function createApplication(): Promise<never> {
  throw new Error('API not mocked');
}