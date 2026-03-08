export type JellyfinAuthResult = {
  userId: string;
  username: string;
  isAdmin: boolean;
};

export class JellyfinClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async healthCheck(): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/System/Info/Public`;
    const response = await fetch(url, {
      headers: {
        "X-Emby-Token": this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API error (${response.status})`);
    }
  }
}

type JellyfinAuthResponse = {
  User?: {
    Id?: string;
    Name?: string;
    Policy?: {
      IsAdministrator?: boolean;
    };
  };
};

const getAuthHeader = () => {
  const deviceId = "melodarr-web";
  return `MediaBrowser Client=\"Melodarr\", Device=\"Web\", DeviceId=\"${deviceId}\", Version=\"0.1.0\"`;
};

export const authenticateWithJellyfin = async (
  jellyfinUrl: string,
  username: string,
  password: string
): Promise<JellyfinAuthResult> => {
  const url = `${jellyfinUrl.replace(/\/$/, "")}/Users/AuthenticateByName`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Authorization": getAuthHeader()
    },
    body: JSON.stringify({ Username: username, Pw: password })
  });

  if (!response.ok) {
    throw new Error("Invalid Jellyfin credentials");
  }

  const payload = (await response.json()) as JellyfinAuthResponse;
  const user = payload.User;

  if (!user?.Id || !user.Name) {
    throw new Error("Jellyfin did not return user details");
  }

  return {
    userId: user.Id,
    username: user.Name,
    isAdmin: Boolean(user.Policy?.IsAdministrator)
  };
};
