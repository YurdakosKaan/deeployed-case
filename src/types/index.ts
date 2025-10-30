export interface PullRequestOpenedPayload {
    action: "opened";
    number: number;
    pull_request: {
      number: number;
      title: string;
      user: {
        login: string;
      };
    };
    repository: {
      name: string;
      owner: {
        login: string;
      };
    };
    installation?: {
      id: number;
    };
  }

