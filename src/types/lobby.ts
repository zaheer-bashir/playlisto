export interface Playlist {
  id: string;
  name: string;
  imageUrl?: string;
  tracks:
    | {
        items?: Array<any>;
        length?: number;
      }
    | number;
}
