export interface UserPermissions {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_superuser: boolean;
    role: {
      id: number;
      name: string;
      description: string;
    };
  };
  permissions: {
    [key: string]: string[]; // model_name: [permission_codes]
  };
  groups: string[];
}

export interface Permission {
  codename: string;
  name: string;
  app_label: string;
  model: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}
