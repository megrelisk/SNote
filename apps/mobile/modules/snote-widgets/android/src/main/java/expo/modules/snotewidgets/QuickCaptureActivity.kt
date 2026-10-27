package expo.modules.snotewidgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

/**
 * Floating Quick Capture dialog shown over the home screen (the main app UI is
 * never opened). Users type the note and pick the target Drive and Folder from
 * dropdowns. The note is queued in shared storage and synced immediately in the
 * background through [CaptureSyncService] (or later, if offline).
 */
class QuickCaptureActivity : Activity() {
  private lateinit var driveSpinner: Spinner
  private lateinit var folderSpinner: Spinner
  private lateinit var input: EditText
  private var widgetId: Int? = null
  private var drives: List<WidgetStore.DriveOption> = emptyList()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_quick_capture)
    setFinishOnTouchOutside(false)

    widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      .takeIf { it != AppWidgetManager.INVALID_APPWIDGET_ID }

    driveSpinner = findViewById(R.id.capture_drive_spinner)
    folderSpinner = findViewById(R.id.capture_folder_spinner)
    input = findViewById(R.id.capture_text)
    val status = findViewById<TextView>(R.id.capture_status)

    val snapshot = WidgetStore.snapshot(this)
    drives = snapshot.targets.filter { it.folders.isNotEmpty() }
    if (!snapshot.signedIn || drives.isEmpty()) {
      status.visibility = View.VISIBLE
      status.text = "Open SNote once to sign in and sync your Drives."
      findViewById<Button>(R.id.capture_save).apply {
        text = "Open SNote"
        setOnClickListener {
          startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("snote://")).setPackage(packageName))
          finish()
        }
      }
      findViewById<Button>(R.id.capture_cancel).setOnClickListener { finish() }
      return
    }

    intent.getStringExtra(EXTRA_PREFILL)?.let {
      input.setText(it)
      input.setSelection(it.length)
    }

    val target = WidgetStore.captureTarget(this, widgetId)
    driveSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, drives.map { "${it.icon} ${it.name}" })
    val driveIndex = drives.indexOfFirst { it.id == target?.driveId }.coerceAtLeast(0)
    driveSpinner.setSelection(driveIndex)
    bindFolders(drives[driveIndex], target?.folderId)
    driveSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
      override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
        val drive = drives[position]
        val currentFolder = (folderSpinner.tag as? List<*>)?.getOrNull(folderSpinner.selectedItemPosition) as? String
        bindFolders(drive, currentFolder)
      }
      override fun onNothingSelected(parent: AdapterView<*>?) {}
    }

    findViewById<Button>(R.id.capture_cancel).setOnClickListener { finish() }
    findViewById<Button>(R.id.capture_save).setOnClickListener { save() }
    input.requestFocus()
  }

  private fun bindFolders(drive: WidgetStore.DriveOption, preferredFolderId: String?) {
    folderSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, drive.folders.map { "📁 ${it.name}" })
    folderSpinner.tag = drive.folders.map { it.id }
    folderSpinner.setSelection(drive.folders.indexOfFirst { it.id == preferredFolderId }.coerceAtLeast(0))
  }

  private fun save() {
    val text = input.text.toString()
    if (text.isBlank()) {
      input.error = "Write something first"
      return
    }
    val drive = drives[driveSpinner.selectedItemPosition]
    val folder = drive.folders[folderSpinner.selectedItemPosition.coerceIn(0, drive.folders.size - 1)]
    val capture = JSONObject()
      .put("id", WidgetStore.newId())
      .put("text", text)
      .put("driveId", drive.id)
      .put("folderId", folder.id)
      .put("createdAt", System.currentTimeMillis())
      .put("source", "widget")

    WidgetStore.enqueueCapture(this, capture)
    WidgetStore.setCaptureTarget(this, widgetId, WidgetStore.Target(drive.id, folder.id))
    val lines = text.trim().lines()
    WidgetStore.addOptimisticCard(this, capture, lines.first().trim(), lines.drop(1).joinToString(" ").trim())
    WidgetUpdater.updateAll(this)
    CaptureSyncService.start(this)

    Toast.makeText(this, "Saved to ${drive.name} / ${folder.name}", Toast.LENGTH_SHORT).show()
    finish()
  }

  companion object {
    const val EXTRA_PREFILL = "snote.prefill"
  }
}
