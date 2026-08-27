package app.cadence.core.common.util

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

object DateUtil {
    private val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    private val displayFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
    private val weekdayFormatter = DateTimeFormatter.ofPattern("EEEE, MMM d")

    fun today(): String = LocalDate.now().format(isoFormatter)
    fun todayDisplay(): String = LocalDate.now().format(displayFormatter)
    fun todayWeekday(): String = LocalDate.now().format(weekdayFormatter)

    fun parse(date: String): LocalDate = LocalDate.parse(date, isoFormatter)
    fun format(date: LocalDate): String = date.format(isoFormatter)
    fun display(date: LocalDate): String = date.format(displayFormatter)

    fun daysBetween(a: String, b: String): Long {
        return ChronoUnit.DAYS.between(parse(a), parse(b))
    }

    fun addDays(date: String, days: Int): String {
        return format(parse(date).plusDays(days.toLong()))
    }

    fun dayOfWeek(date: String): DayOfWeek = parse(date).dayOfWeek

    fun isWeekend(date: String): Boolean {
        val dow = dayOfWeek(date)
        return dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY
    }

    fun daysInRange(start: String, end: String): List<String> {
        val s = parse(start)
        val e = parse(end)
        return generateSequence(s) { it.plusDays(1) }
            .takeWhile { !it.isAfter(e) }
            .map { format(it) }
            .toList()
    }

    fun weekStart(date: String): String {
        return format(parse(date).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)))
    }

    fun weekEnd(date: String): String {
        return format(parse(date).with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)))
    }

    fun toInstant(date: String): Instant {
        return parse(date).atStartOfDay().toInstant(ZoneOffset.UTC)
    }

    fun minutesToDisplay(minutes: Int): String {
        return when {
            minutes < 60 -> "${minutes}m"
            minutes % 60 == 0 -> "${minutes / 60}h"
            else -> "${minutes / 60}h ${minutes % 60}m"
        }
    }

    fun hoursToDisplay(hours: Double): String {
        val h = hours.toInt()
        val m = ((hours - h) * 60).toInt()
        return when {
            h == 0 -> "${m}m"
            m == 0 -> "${h}h"
            else -> "${h}h ${m}m"
        }
    }

    fun relativeDate(date: String): String {
        val days = daysBetween(today(), date)
        return when (days) {
            0L -> "Today"
            1L -> "Tomorrow"
            -1L -> "Yesterday"
            in 2..6 -> "in $days days"
            in -6..-2 -> "${-days} days ago"
            else -> display(parse(date))
        }
    }
}
