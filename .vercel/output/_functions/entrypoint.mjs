import { s as supabase } from './chunks/supabase_CS-9eM7J.mjs';
import * as z from 'zod';
import { d as defineAction } from './chunks/server_BxKhI8SW.mjs';

const server = {
  createEvent: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().optional(),
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
      location: z.string().min(1, "Location is required"),
      image: z.instanceof(File).optional()
    }),
    handler: async (input) => {
      let imageUrl = null;
      if (input.image && input.image.size > 0) {
        const fileExt = input.image.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;
        const { error: uploadError } = await supabase.storage.from("event-images").upload(filePath, input.image);
        if (uploadError) {
          throw new Error(`Upload Failed: ${uploadError.message}`);
        }
        const { data: publicData } = supabase.storage.from("event-images").getPublicUrl(filePath);
        imageUrl = publicData.publicUrl;
      }
      const eventData = {
        title: input.title,
        description: input.description,
        date: input.date,
        location: input.location
      };
      if (imageUrl) {
        eventData.image_url = imageUrl;
      }
      let data, error;
      if (input.id) {
        ({ data, error } = await supabase.from("events").update(eventData).eq("id", input.id).select());
      } else {
        if (!imageUrl && !input.id && !input.image) ;
        eventData.image_url = imageUrl;
        ({ data, error } = await supabase.from("events").insert([eventData]).select());
      }
      if (error) {
        throw new Error(`Operation Failed: ${error.message}`);
      }
      return { success: true, event: data ? data[0] : null };
    }
  })
};

export { server };
