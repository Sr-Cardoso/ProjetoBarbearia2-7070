import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { adminBase, customerBase } from "../middleware/auth";
import { s3, S3_BUCKET } from "../lib/s3";

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .toLowerCase()
    .slice(-60);

export const upload = {
  /**
   * URL assinada para o painel enviar a imagem direto ao storage.
   * O site consome o arquivo depois por `/api/files/<key>`.
   */
  presign: adminBase
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.string().min(1),
      }),
    )
    .handler(async ({ input, context }) => {
      const key = `sites/${context.tenant.id}/${Date.now()}-${slug(input.filename)}`;

      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          ContentType: input.contentType,
        }),
        { expiresIn: 600 },
      );

      return { url, key, publicUrl: `/api/files/${key}` };
    }),

  /** URL assinada para o cliente logado trocar a própria foto de perfil. */
  presignAvatar: customerBase
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.string().regex(/^image\//, "Envie uma imagem"),
      }),
    )
    .handler(async ({ input, context }) => {
      const key = `avatars/${context.tenant.id}/${context.user.id}/${Date.now()}-${slug(input.filename)}`;

      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          ContentType: input.contentType,
        }),
        { expiresIn: 600 },
      );

      return { url, key, publicUrl: `/api/files/${key}` };
    }),
};
