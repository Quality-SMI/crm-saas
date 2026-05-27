import apiClient from './client';
import type { AxiosResponse } from 'axios';

export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogAuthor {
  id: string;
  client_id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  profile_url: string | null;
}

export interface BlogCategory {
  id: string;
  client_id: string;
  name: string;
  slug: string;
}

export interface BlogTag {
  id: string;
  client_id: string;
  name: string;
  slug: string;
}

export interface BlogArticle {
  id: string;
  client_id: string;
  title: string;
  slug: string;
  description: string | null;
  image: string | null;
  content: string | null;
  raw_content: Record<string, unknown> | null;
  status: ArticleStatus;
  date_published: string | null;
  author: BlogAuthor | null;
  category: BlogCategory | null;
  tags: BlogTag[];
  created_at: string;
  updated_at: string;
}

export interface CreateArticleBody {
  title: string;
  slug: string;
  description?: string;
  image?: string;
  content?: string;
  raw_content?: Record<string, unknown>;
  status?: ArticleStatus;
  author_id?: string;
  category_id?: string;
  tag_ids?: string[];
}

export const blogApi = {
  // Articles
  listArticles(clientId: string): Promise<BlogArticle[]> {
    return apiClient.get<{ data: BlogArticle[] }>(`/blog/clients/${clientId}`).then((r: AxiosResponse<{ data: BlogArticle[] }>) => r.data.data);
  },

  getArticle(clientId: string, id: string): Promise<BlogArticle> {
    return apiClient.get<{ data: BlogArticle }>(`/blog/clients/${clientId}/articles/${id}`).then((r: AxiosResponse<{ data: BlogArticle }>) => r.data.data);
  },

  createArticle(clientId: string, body: CreateArticleBody): Promise<BlogArticle> {
    return apiClient.post<{ data: BlogArticle }>(`/blog/clients/${clientId}`, body).then((r: AxiosResponse<{ data: BlogArticle }>) => r.data.data);
  },

  updateArticle(clientId: string, id: string, body: Partial<CreateArticleBody>): Promise<BlogArticle> {
    return apiClient.patch<{ data: BlogArticle }>(`/blog/clients/${clientId}/articles/${id}`, body).then((r: AxiosResponse<{ data: BlogArticle }>) => r.data.data);
  },

  deleteArticle(clientId: string, id: string): Promise<void> {
    return apiClient.delete(`/blog/clients/${clientId}/articles/${id}`).then(() => undefined);
  },

  // Authors
  listAuthors(clientId: string): Promise<BlogAuthor[]> {
    return apiClient.get<{ data: BlogAuthor[] }>(`/blog/clients/${clientId}/authors`).then((r: AxiosResponse<{ data: BlogAuthor[] }>) => r.data.data);
  },

  createAuthor(clientId: string, name: string, bio?: string, avatar_url?: string, profile_url?: string): Promise<BlogAuthor> {
    return apiClient.post<{ data: BlogAuthor }>(`/blog/clients/${clientId}/authors`, { name, bio, avatar_url, profile_url }).then((r: AxiosResponse<{ data: BlogAuthor }>) => r.data.data);
  },

  deleteAuthor(id: string): Promise<void> {
    return apiClient.delete(`/blog/authors/${id}`).then(() => undefined);
  },

  // Categories
  listCategories(clientId: string): Promise<BlogCategory[]> {
    return apiClient.get<{ data: BlogCategory[] }>(`/blog/clients/${clientId}/categories`).then((r: AxiosResponse<{ data: BlogCategory[] }>) => r.data.data);
  },

  createCategory(clientId: string, name: string, slug: string): Promise<BlogCategory> {
    return apiClient.post<{ data: BlogCategory }>(`/blog/clients/${clientId}/categories`, { name, slug }).then((r: AxiosResponse<{ data: BlogCategory }>) => r.data.data);
  },

  deleteCategory(id: string): Promise<void> {
    return apiClient.delete(`/blog/categories/${id}`).then(() => undefined);
  },

  // Tags
  listTags(clientId: string): Promise<BlogTag[]> {
    return apiClient.get<{ data: BlogTag[] }>(`/blog/clients/${clientId}/tags`).then((r: AxiosResponse<{ data: BlogTag[] }>) => r.data.data);
  },

  createTag(clientId: string, name: string, slug: string): Promise<BlogTag> {
    return apiClient.post<{ data: BlogTag }>(`/blog/clients/${clientId}/tags`, { name, slug }).then((r: AxiosResponse<{ data: BlogTag }>) => r.data.data);
  },

  deleteTag(id: string): Promise<void> {
    return apiClient.delete(`/blog/tags/${id}`).then(() => undefined);
  },
};
