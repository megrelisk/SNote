package expo.modules.snotewidgets

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom

/**
 * Shared storage between the app (via [SnoteWidgetsModule]) and the widgets.
 * Mirrors the `WidgetSnapshot` / `PendingCapture` contracts in
 * `packages/core/src/widget.ts`; keep both in sync.
 */
object WidgetStore {
  private const val PREFS = "snote_widgets"
  const val SNAPSHOT_KEY = "snote.widget.snapshot"
  const val CAPTURE_QUEUE_KEY = "snote.widget.captures"
  private const val LAST_TARGET_KEY = "snote.widget.lastTarget"

  data class FolderOption(val id: String, val name: String)
  data class DriveOption(val id: String, val name: String, val icon: String, val folders: List<FolderOption>)
  data class Target(val driveId: String, val folderId: String)
  data class Card(
    val id: String,
    val title: String,
    val preview: String,
    val driveId: String,
    val driveName: String,
    val driveIcon: String,
    val folderId: String,
    val folderName: String,
    val pinned: Boolean,
    val updatedAt: Long,
    val updatedAtLabel: String,
    val deepLink: String,
  )
  data class Snapshot(
    val signedIn: Boolean,
    val userName: String?,
    val targets: List<DriveOption>,
    val defaultTarget: Target?,
    val notes: List<Card>,
  )

  /** Carousel source, persisted per widget id. Serialized as `kind[:id]`. */
  sealed class Source {
    object Recent : Source()
    object Pinned : Source()
    data class Drive(val driveId: String) : Source()
    data class Folder(val folderId: String) : Source()

    fun serialize(): String = when (this) {
      Recent -> "recent"
      Pinned -> "pinned"
      is Drive -> "drive:$driveId"
      is Folder -> "folder:$folderId"
    }

    companion object {
      fun parse(raw: String?): Source = when {
        raw == null -> Recent
        raw == "pinned" -> Pinned
        raw.startsWith("drive:") -> Drive(raw.removePrefix("drive:"))
        raw.startsWith("folder:") -> Folder(raw.removePrefix("folder:"))
        else -> Recent
      }
    }
  }

  fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  // -- Snapshot ---------------------------------------------------------------

  fun saveSnapshot(context: Context, json: String) {
    prefs(context).edit().putString(SNAPSHOT_KEY, json).apply()
  }

  fun snapshot(context: Context): Snapshot {
    val raw = prefs(context).getString(SNAPSHOT_KEY, null) ?: return Snapshot(false, null, emptyList(), null, emptyList())
    return try {
      parseSnapshot(JSONObject(raw))
    } catch (e: Exception) {
      Snapshot(false, null, emptyList(), null, emptyList())
    }
  }

  private fun parseSnapshot(o: JSONObject): Snapshot {
    val targets = o.optJSONArray("targets").objects().map { d ->
      DriveOption(
        d.optString("id"),
        d.optString("name"),
        d.optString("icon", "🗂"),
        d.optJSONArray("folders").objects().map { f -> FolderOption(f.optString("id"), f.optString("name")) },
      )
    }
    val dt = o.optJSONObject("defaultTarget")
    val notes = o.optJSONArray("notes").objects().map { n ->
      Card(
        id = n.optString("id"),
        title = n.optString("title", "Untitled"),
        preview = n.optString("preview"),
        driveId = n.optString("driveId"),
        driveName = n.optString("driveName"),
        driveIcon = n.optString("driveIcon", "🗂"),
        folderId = n.optString("folderId"),
        folderName = n.optString("folderName"),
        pinned = n.optBoolean("pinned"),
        updatedAt = n.optLong("updatedAt"),
        updatedAtLabel = n.optString("updatedAtLabel"),
        deepLink = n.optString("deepLink"),
      )
    }
    return Snapshot(
      signedIn = o.optBoolean("signedIn"),
      userName = if (o.isNull("userName")) null else o.optString("userName"),
      targets = targets,
      defaultTarget = dt?.let { Target(it.optString("driveId"), it.optString("folderId")) },
      notes = notes,
    )
  }

  private fun JSONArray?.objects(): List<JSONObject> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optJSONObject(it) }
  }

  /** Same filtering as `selectCarouselNotes` in @snote/core. */
  fun cardsFor(context: Context, source: Source, limit: Int = 10): List<Card> {
    val notes = snapshot(context).notes
    val filtered = when (source) {
      Source.Recent -> notes
      Source.Pinned -> notes.filter { it.pinned }
      is Source.Drive -> notes.filter { it.driveId == source.driveId }
      is Source.Folder -> notes.filter { it.folderId == source.folderId }
    }
    return filtered.take(limit)
  }

  fun sourceLabel(context: Context, source: Source): String {
    val snap = snapshot(context)
    return when (source) {
      Source.Recent -> "Recently modified"
      Source.Pinned -> "Pinned notes"
      is Source.Drive -> snap.targets.find { it.id == source.driveId }?.let { "${it.icon} ${it.name}" } ?: "Drive"
      is Source.Folder -> snap.targets.firstNotNullOfOrNull { d ->
        d.folders.find { it.id == source.folderId }?.let { "${d.icon} ${d.name} / ${it.name}" }
      } ?: "Folder"
    }
  }

  // -- Per-widget configuration ----------------------------------------------

  fun carouselSource(context: Context, widgetId: Int): Source =
    Source.parse(prefs(context).getString("carousel.$widgetId", null))

  fun setCarouselSource(context: Context, widgetId: Int, source: Source) {
    prefs(context).edit().putString("carousel.$widgetId", source.serialize()).apply()
  }

  /** Quick Capture target for a widget: its own choice, else the last used, else the snapshot default. */
  fun captureTarget(context: Context, widgetId: Int?): Target? {
    val snap = snapshot(context)
    val p = prefs(context)
    val candidates = listOfNotNull(
      widgetId?.let { parseTarget(p.getString("capture.$it", null)) },
      parseTarget(p.getString(LAST_TARGET_KEY, null)),
      snap.defaultTarget,
    )
    return candidates.firstOrNull { isValid(snap, it) } ?: snap.targets.firstOrNull { it.folders.isNotEmpty() }?.let {
      Target(it.id, it.folders.first().id)
    }
  }

  fun setCaptureTarget(context: Context, widgetId: Int?, target: Target) {
    val edit = prefs(context).edit().putString(LAST_TARGET_KEY, "${target.driveId}/${target.folderId}")
    if (widgetId != null) edit.putString("capture.$widgetId", "${target.driveId}/${target.folderId}")
    edit.apply()
  }

  fun forgetWidget(context: Context, widgetId: Int) {
    prefs(context).edit().remove("carousel.$widgetId").remove("capture.$widgetId").apply()
  }

  private fun parseTarget(raw: String?): Target? {
    val parts = raw?.split("/") ?: return null
    return if (parts.size == 2) Target(parts[0], parts[1]) else null
  }

  private fun isValid(snap: Snapshot, t: Target): Boolean =
    snap.targets.any { d -> d.id == t.driveId && d.folders.any { it.id == t.folderId } }

  /** Next drive (wrapping), keeping its first folder. Used by the in-widget drive chip. */
  fun cycleDrive(context: Context, widgetId: Int) {
    val snap = snapshot(context)
    val drives = snap.targets.filter { it.folders.isNotEmpty() }
    if (drives.isEmpty()) return
    val current = captureTarget(context, widgetId)
    val i = drives.indexOfFirst { it.id == current?.driveId }
    val next = drives[(i + 1).mod(drives.size)]
    setCaptureTarget(context, widgetId, Target(next.id, next.folders.first().id))
  }

  /** Next folder within the current drive (wrapping). Used by the in-widget folder chip. */
  fun cycleFolder(context: Context, widgetId: Int) {
    val snap = snapshot(context)
    val current = captureTarget(context, widgetId) ?: return
    val drive = snap.targets.find { it.id == current.driveId } ?: return
    if (drive.folders.isEmpty()) return
    val i = drive.folders.indexOfFirst { it.id == current.folderId }
    setCaptureTarget(context, widgetId, Target(drive.id, drive.folders[(i + 1).mod(drive.folders.size)].id))
  }

  fun describe(context: Context, target: Target?): Pair<String, String> {
    val snap = snapshot(context)
    val drive = snap.targets.find { it.id == target?.driveId }
    val folder = drive?.folders?.find { it.id == target?.folderId }
    return Pair(drive?.let { "${it.icon} ${it.name}" } ?: "No drive", folder?.name ?: "No folder")
  }

  // -- Capture queue ----------------------------------------------------------

  fun pendingCaptures(context: Context): String = prefs(context).getString(CAPTURE_QUEUE_KEY, "[]") ?: "[]"

  @Synchronized
  fun enqueueCapture(context: Context, capture: JSONObject) {
    val queue = try { JSONArray(pendingCaptures(context)) } catch (e: Exception) { JSONArray() }
    queue.put(capture)
    prefs(context).edit().putString(CAPTURE_QUEUE_KEY, queue.toString()).apply()
  }

  @Synchronized
  fun removeCaptures(context: Context, ids: Collection<String>) {
    val queue = try { JSONArray(pendingCaptures(context)) } catch (e: Exception) { JSONArray() }
    val kept = JSONArray()
    queue.objects().filter { it.optString("id") !in ids }.forEach { kept.put(it) }
    prefs(context).edit().putString(CAPTURE_QUEUE_KEY, kept.toString()).apply()
  }

  /**
   * Shows a just-captured note in carousels immediately (before the app syncs
   * and publishes a fresh snapshot).
   */
  @Synchronized
  fun addOptimisticCard(context: Context, capture: JSONObject, title: String, preview: String) {
    val raw = prefs(context).getString(SNAPSHOT_KEY, null) ?: return
    try {
      val snap = JSONObject(raw)
      val (driveLabel, folderName) = describe(context, Target(capture.optString("driveId"), capture.optString("folderId")))
      val drive = snapshot(context).targets.find { it.id == capture.optString("driveId") }
      val card = JSONObject()
        .put("id", capture.optString("id"))
        .put("title", title.ifBlank { "Untitled" })
        .put("preview", preview)
        .put("driveId", capture.optString("driveId"))
        .put("driveName", drive?.name ?: driveLabel)
        .put("driveIcon", drive?.icon ?: "🗂")
        .put("folderId", capture.optString("folderId"))
        .put("folderName", folderName)
        .put("pinned", false)
        .put("updatedAt", capture.optLong("createdAt"))
        .put("updatedAtLabel", "just now")
        .put("deepLink", "snote://note/${capture.optString("id")}")
      val notes = JSONArray().put(card)
      snap.optJSONArray("notes").objects().forEach { notes.put(it) }
      snap.put("notes", notes)
      prefs(context).edit().putString(SNAPSHOT_KEY, snap.toString()).apply()
    } catch (e: Exception) {
      // Optimistic only; the next real snapshot will include the note anyway.
    }
  }

  private val random = SecureRandom()
  private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

  /** Same id shape as `newId()` in @snote/core. */
  fun newId(): String = (1..20).map { ALPHABET[random.nextInt(ALPHABET.length)] }.joinToString("")
}
