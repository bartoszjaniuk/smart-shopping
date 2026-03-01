/**
 * Shared types for backend and frontend: Entities (from DB), DTOs (API responses),
 * and Command models (API request bodies). All DTOs and Commands derive from
 * database entity definitions in src/db/database.types.ts.
 */

import type { Tables, TablesInsert, Enums } from "./db/database.types";

// ---------------------------------------------------------------------------
// Entity aliases (DB Row types) – base for DTOs and Commands
// ---------------------------------------------------------------------------

/** Profile row (profiles table). */
export type ProfileRow = Tables<"profiles">;

/** Category row (categories table). */
export type CategoryRow = Tables<"categories">;

/** List row (lists table). */
export type ListRow = Tables<"lists">;

/** List membership row (list_memberships table). */
export type ListMembershipRow = Tables<"list_memberships">;

/** List item row (list_items table). */
export type ListItemRow = Tables<"list_items">;

/** Invite code row (invite_codes table). */
export type InviteCodeRow = Tables<"invite_codes">;

/** AI category cache row (ai_category_cache table, admin). */
export type AiCategoryCacheRow = Tables<"ai_category_cache">;

// ---------------------------------------------------------------------------
// Enums (from DB) – reused in DTOs and Commands
// ---------------------------------------------------------------------------

export type MembershipRole = Enums<"membership_role">;
export type PlanType = Enums<"plan_type">;

/** Source of category assignment for a list item (API-only, not stored in list_items). */
export type CategorySource = "cache" | "ai" | "fallback";

// ---------------------------------------------------------------------------
// Pagination (shared by list/list-items responses)
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_count: number;
}

// ---------------------------------------------------------------------------
// Profile – DTOs and Commands (from profiles)
// ---------------------------------------------------------------------------

/** GET /api/profile response. Maps 1:1 to profiles row. */
export type ProfileDto = ProfileRow;

/** PATCH /api/profile request body. Only updatable fields. */
export type UpdateProfileCommand = Partial<Pick<ProfileRow, "plan" | "preferred_locale">>;

// ---------------------------------------------------------------------------
// Categories – DTOs (from categories); name is localized in API layer
// ---------------------------------------------------------------------------

/**
 * GET /api/categories response item. Derived from CategoryRow with a single
 * localized `name` (name_pl or name_en chosen by locale); no name_pl/name_en in response.
 */
export interface CategoryDto {
  id: CategoryRow["id"];
  code: CategoryRow["code"];
  /** Localized name (name_pl or name_en per request locale). */
  name: string;
  sort_order: CategoryRow["sort_order"];
}

// ---------------------------------------------------------------------------
// Lists – DTOs and Commands (from lists)
// ---------------------------------------------------------------------------

/** Base list fields returned by POST 201 and GET single list (no computed fields). */
export type ListDto = Pick<ListRow, "id" | "owner_id" | "name" | "color" | "created_at" | "updated_at">;

/**
 * GET /api/lists response item. ListDto + computed is_disabled, optional item_count, my_role.
 * is_disabled and my_role are computed in API (not DB columns).
 */
export interface ListSummaryDto extends ListDto {
  is_disabled: boolean;
  item_count?: number;
  my_role: MembershipRole;
}

/**
 * GET /api/lists/:listId response. ListDto + computed is_disabled and my_role.
 */
export interface ListDetailDto extends ListDto {
  is_disabled: boolean;
  my_role: MembershipRole;
}

/** POST /api/lists request body. name required; color optional (default #C3B1E1); owner_id set server-side. */
export type CreateListCommand = Pick<ListRow, "name"> & {
  color?: ListRow["color"];
};

/** Default list color when not provided in POST /api/lists. */
export const DEFAULT_LIST_COLOR = "#C3B1E1" as const;

/** PATCH /api/lists/:listId request body. At least one field required (validated in API). */
export type UpdateListCommand = Partial<Pick<ListRow, "name" | "color">>;

// ---------------------------------------------------------------------------
// Lists dashboard – DTOs and ViewModels (frontend)
// ---------------------------------------------------------------------------

/** GET /api/lists response wrapper used by the lists dashboard (pagination metadata + items). */
export interface ListsListResponseDto {
  data: ListSummaryDto[];
  meta: PaginationMeta;
}

/** Filter applied to lists on the /lists dashboard. */
export type ListsFilter = "all" | "owned" | "shared";

/** Aggregated view model describing current state of the /lists dashboard. */
export interface ListsDashboardViewModel {
  lists: ListSummaryDto[];
  filteredLists: ListSummaryDto[];
  filter: ListsFilter;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  page: number;
  pageSize: number;
  totalCount: number;
  plan?: PlanType;
  ownedListsCount: number;
  hasReachedListLimit: boolean;
}

/** View model for a single list tile on the dashboard. */
export interface ListCardViewModel {
  id: string;
  name: string;
  color: string;
  itemCountLabel: string;
  roleLabel: string;
  isDisabled: boolean;
  isOwner?: boolean;
}

/** View model for the plan information banner rendered above the lists grid. */
export interface PlanBannerViewModel {
  plan: PlanType;
  ownedListsCount: number;
  maxLists: number | null;
  limitReached: boolean;
  description: string;
}

/** Local form model for creating a new list from the dashboard. Mirrors CreateListCommand shape. */
export interface NewListFormValues {
  name: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// List form – shared view types (frontend)
// ---------------------------------------------------------------------------

/** Mode in which the reusable ListForm component operates. */
export type ListFormMode = "create" | "edit";

/** Local form values for creating or editing a list. */
export interface ListFormValues {
  name: string;
  color?: string;
}

/** Aggregated view model describing ListForm UI state. */
export interface ListFormViewModel {
  values: ListFormValues;
  isSubmitting: boolean;
  isPristine: boolean;
  serverError?: string;
  plan?: PlanType;
  hasReachedListLimit?: boolean;
}

/** Single pastel color option used in list color pickers. */
export interface PastelColorOption {
  value: string;
  label: string;
  isRecommended?: boolean;
}

/** Public props for the reusable ListForm React component. */
export interface ListFormProps {
  mode: ListFormMode;
  initialValues?: ListFormValues;
  plan?: PlanType;
  /** Required in edit mode to call PATCH /api/lists/:listId. Ignored in create mode. */
  listId?: string;
  onSuccessCreate?(list: ListDto | ListDetailDto): void;
  onSuccessUpdate?(list: ListDetailDto): void;
  onCancel?(): void;
}

// ---------------------------------------------------------------------------
// List members – DTO (from list_memberships + auth)
// ---------------------------------------------------------------------------

/**
 * GET /api/lists/:listId/members response item. ListMembershipRow + email
 * (from auth/profile, not stored in list_memberships).
 */
export interface ListMemberDto extends ListMembershipRow {
  email: string;
}

// ---------------------------------------------------------------------------
// List items – DTOs and Commands (from list_items)
// ---------------------------------------------------------------------------

/**
 * GET /api/lists/:listId/items and PATCH response item. List item with category_code
 * (resolved from categories table); name_normalized omitted from API. Optional
 * category_source only in POST 201 response (UX/toast).
 */
export interface ListItemDto extends Omit<ListItemRow, "name_normalized"> {
  /** Category code from categories table (denormalized for API). */
  category_code: string;
  /** Present only in POST 201 response: how category was resolved. */
  category_source?: CategorySource;
}

/** POST /api/lists/:listId/items request body. Name required; category resolved by backend. */
export type CreateListItemCommand = Pick<ListItemRow, "name">;

/** PATCH /api/lists/:listId/items/:itemId request body. */
export type UpdateListItemCommand = Partial<Pick<ListItemRow, "name" | "category_id" | "is_purchased">>;

/** POST /api/lists/:listId/items/clear-purchased response. */
export interface ClearPurchasedResponseDto {
  deleted_count: number;
}

/** GET /api/lists/:listId/items response wrapper used by the list detail view. */
export interface ListItemsListResponseDto {
  data: ListItemDto[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// List detail view – frontend view models
// ---------------------------------------------------------------------------

/** Simplified item model used by ItemRow and related list detail components. */
export interface ItemRowViewModel {
  id: string;
  name: string;
  categoryCode: string;
  isPurchased: boolean;
  createdAt: string;
  categoryName?: string;
}

/** Group of not-purchased items belonging to a single category in the list detail view. */
export interface CategorySectionViewModel {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  items: ItemRowViewModel[];
}

/** Connection and synchronization status for Supabase Realtime in the list detail view. */
export type RealtimeStatus = "connecting" | "online" | "offline" | "syncing" | "unavailable";

/** Aggregated view model describing current state of the /lists/:listId detail view. */
export interface ListDetailViewModel {
  list: ListDetailDto | null;
  items: ListItemDto[];
  categorySections: CategorySectionViewModel[];
  purchasedItems: ItemRowViewModel[];
  isLoadingList: boolean;
  isLoadingItems: boolean;
  isMutating: boolean;
  isError: boolean;
  errorMessage?: string;
  /** Ustawiane przez Realtime przy evencie list_deleted – UI pokazuje komunikat i „Wróć do list”. */
  listDeleted?: boolean;
  isOffline: boolean;
  realtimeStatus: RealtimeStatus;
  canEditItems: boolean;
  canClearPurchased: boolean;
}

/** Local form model for adding a new item on the list detail view. */
export interface AddItemFormValues {
  name: string;
}

// ---------------------------------------------------------------------------
// Invite codes – DTOs and Commands (from invite_codes, list_memberships)
// ---------------------------------------------------------------------------

/**
 * POST /api/lists/:listId/invites response (201). InviteCodeRow plus join_url
 * (generated by API; not stored in DB).
 */
export interface InviteCodeDto extends InviteCodeRow {
  join_url: string;
}

/** GET /api/lists/:listId/invites response item. Subset of invite_codes (no list_id in payload). */
export type InviteCodeSummaryDto = Pick<InviteCodeRow, "id" | "code" | "created_at" | "expires_at" | "used_at">;

/** POST /api/lists/:listId/invites request body. Optional override for expiry. */
export interface CreateInviteCommand {
  expires_in_hours?: number;
}

/** POST /api/invites/join request body. Code normalized to uppercase by backend. */
export interface JoinByInviteCommand {
  code: string;
}

/**
 * POST /api/invites/join response. Result of joining a list via code; no direct
 * single table – list_id/list_name from lists, role from created list_memberships.
 */
export interface JoinByInviteResponseDto {
  list_id: string;
  list_name: string;
  role: MembershipRole;
}

// ---------------------------------------------------------------------------
// Admin – Category and AI cache (from categories, ai_category_cache)
// ---------------------------------------------------------------------------

/** PATCH /api/admin/categories/:id request body. Only updatable fields. */
export type UpdateCategoryCommand = Partial<Pick<CategoryRow, "name_pl" | "name_en" | "sort_order">>;

/** GET /api/admin/ai-cache and POST response item. Maps 1:1 to ai_category_cache row. */
export type AiCategoryCacheDto = AiCategoryCacheRow;

/** POST /api/admin/ai-cache request body. Matches Insert shape; id/created_at/updated_at optional. */
export type CreateAiCategoryCacheCommand = TablesInsert<"ai_category_cache">;
