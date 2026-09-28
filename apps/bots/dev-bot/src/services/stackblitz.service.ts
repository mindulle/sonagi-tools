import { assertEnvVariable } from '@sonagi-bots/shared';

class StackBlitzService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = assertEnvVariable('STACKBLITZ_BASE_URL');
  }

  generateUrl(repositoryPath: string): string {
    // repositoryPath 예시: "github/hotssi/sandbox/tree/main/react/button"
    return `${this.baseUrl}/${repositoryPath}`;
  }

  generateGitHubUrl(owner: string, repo: string, path: string): string {
    return this.generateUrl(`github/${owner}/${repo}/tree/main/${path}`);
  }
}

export const stackBlitzService = new StackBlitzService();
