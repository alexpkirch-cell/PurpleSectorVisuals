import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto"
import { writeFileSync } from "node:fs"
import { Pool } from "pg"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const url = new URL(process.env.POSTGRES_URL)
url.searchParams.delete("sslmode")
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const sha = (value) => createHash("sha256").update(value).digest("hex")
const scrypt = (value, salt) => scryptSync(value, Buffer.from(salt, "hex"), 64).toString("hex")

const out = { storagePaths: [] }

async function png(color, label) {
  return sharp({ create: { width: 1600, height: 1067, channels: 3, background: color } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067"><rect x="500" y="400" width="600" height="260" fill="#fff" fill-opacity="0.85"/><text x="800" y="560" font-size="90" text-anchor="middle" fill="#111">${label}</text></svg>`) }])
    .jpeg({ quality: 80 })
    .toBuffer()
}

async function uploadPair(prefix, label, color) {
  const id = randomUUID()
  const original = await png(color, `${label} ORIG`)
  const proof = await sharp(original).resize(800).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="534"><rect width="800" height="534" fill="#000" fill-opacity="0.35"/></svg>`) }]).jpeg().toBuffer()
  const watermarkedPath = `${prefix}/${id}-watermarked.jpg`
  const originalPath = `${prefix}/${id}-original.jpg`
  for (const [path, body] of [[watermarkedPath, proof], [originalPath, original]]) {
    const { error } = await supabase.storage.from("roster-vault-media").upload(path, body, { contentType: "image/jpeg" })
    if (error) throw new Error(`upload ${path}: ${error.message}`)
    out.storagePaths.push(path)
  }
  return { watermarkedPath, originalPath }
}

async function createTeam(name, code, mode, extra = {}) {
  const codeSalt = randomBytes(16).toString("hex")
  const passwordSalt = randomBytes(16).toString("hex")
  const { rows } = await pool.query(
    `INSERT INTO roster_vault_teams (name, access_code_salt, access_code_hash, access_code_lookup_hash, password_salt, password_hash, vault_billing_mode, single_photo_price_cents)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [name, codeSalt, scrypt(code, codeSalt), sha(code), passwordSalt, scrypt("verify-password-1", passwordSalt), mode, extra.singlePhotoPriceCents ?? null],
  )
  return rows[0].id
}

async function main() {
  // Admin user
  const email = `v0-verify-${Date.now()}@example.com`
  const password = "V0-verify-admin-2604!"
  const { data: created, error: userError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (userError) throw userError
  await pool.query(`INSERT INTO profiles (id, display_name, role) VALUES ($1, 'V0 Verify Admin', 'admin') ON CONFLICT (id) DO UPDATE SET role = 'admin'`, [created.user.id])
  out.admin = { id: created.user.id, email, password }

  // Standard client vault: delivered, balance unpaid
  const shoot = await pool.query(
    `INSERT INTO shoots (client_name, client_email, vault_access_code, status, shoot_type, total_price, is_comped)
     VALUES ('ZZ Verify Client', 'zz-verify@example.com', '555111', 'delivered_settled', 'portraits', 300, false) RETURNING id`,
  )
  out.shootId = shoot.rows[0].id
  const vault = await pool.query(
    `INSERT INTO vaults (shoot_id, pin_code, status, contract_signed, deposit_paid, deposit_amount, balance_amount, balance_paid, client_name)
     VALUES ($1,'555111','Active',true,true,150,150,false,'ZZ Verify Client') RETURNING id`,
    [out.shootId],
  )
  out.vaultId = vault.rows[0].id
  const publicPhotos = [
    "portraits/ab86d427-8a08-4a34-91fe-741c191873cb.jpg",
    "portraits/b3f5b9b7-5a96-4ea5-9a67-008018c8e38c.jpg",
    "portraits/80bfb3c6-fe68-4055-9445-1aa95c65a349.jpg",
  ]
  for (const [index, path] of publicPhotos.entries()) {
    await pool.query(
      `INSERT INTO vault_photos (vault_id, bucket, storage_path, file_name, sort_order) VALUES ($1,'portfolio-images',$2,$3,$4)`,
      [out.vaultId, path, `verify-${index + 1}.jpg`, index],
    )
  }

  // Roster teams
  out.rosterTeams = {}
  for (const [key, mode, code, extra, tint] of [
    ["parentPay", "parent_pay", "VERIFYPAY1", { singlePhotoPriceCents: 500 }, { r: 40, g: 90, b: 160 }],
    ["buyout", "all_inclusive", "VERIFYALL1", {}, { r: 150, g: 60, b: 90 }],
  ]) {
    const teamId = await createTeam(`ZZ Verify ${key}`, code, mode, extra)
    let tierId = null
    if (mode === "parent_pay") {
      const tier = await pool.query(`INSERT INTO roster_vault_gallery_tiers (team_id, name, price_cents) VALUES ($1,'Standard',3900) RETURNING id`, [teamId])
      tierId = tier.rows[0].id
    }
    const player = await pool.query(
      `INSERT INTO roster_vault_players (team_id, display_name, jersey_number, tier_id) VALUES ($1,$2,'7',$3) RETURNING id`,
      [teamId, `Verify Player ${key}`, tierId],
    )
    const playerId = player.rows[0].id
    for (let i = 0; i < 2; i += 1) {
      const pair = await uploadPair(playerId, `${key} P${i + 1}`, tint)
      await pool.query(
        `INSERT INTO roster_vault_player_photos (player_id, watermarked_path, original_path, alt_text, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [playerId, pair.watermarkedPath, pair.originalPath, `Player photo ${i + 1}`, i],
      )
    }
    const teamPair = await uploadPair(`teams/${teamId}`, `${key} TEAM`, tint)
    await pool.query(
      `INSERT INTO roster_vault_team_photos (team_id, watermarked_path, original_path, alt_text, sort_order) VALUES ($1,$2,$3,'Team photo',0)`,
      [teamId, teamPair.watermarkedPath, teamPair.originalPath],
    )
    await pool.query(
      `INSERT INTO roster_vault_print_products (team_id, name, whcc_product_id, whcc_selections, price_cents) VALUES ($1,'8x10 Lustre','whcc-test','{}'::jsonb,2400)`,
      [teamId],
    )
    out.rosterTeams[key] = { teamId, playerId, code, password: "verify-password-1" }
  }

  writeFileSync(new URL("./fixtures.json", import.meta.url), JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ admin: out.admin.email, vault: { email: "zz-verify@example.com", pin: "555111" }, roster: out.rosterTeams }, null, 1))
}

main()
  .catch((error) => {
    console.error("setup failed:", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
