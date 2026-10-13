package expo.modules.trafficstats

import android.net.TrafficStats
import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Bytes this app's UID has received since boot (covers native audio streaming, which JS fetch can't see).
class TrafficStatsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TrafficStats")
    Function("getRxBytes") { TrafficStats.getUidRxBytes(Process.myUid()).toDouble() }
  }
}
