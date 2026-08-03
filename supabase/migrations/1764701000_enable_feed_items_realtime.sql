-- Migration: enable realtime for feed_items
-- Created at: 1764701000

ALTER PUBLICATION supabase_realtime ADD TABLE feed_items;
