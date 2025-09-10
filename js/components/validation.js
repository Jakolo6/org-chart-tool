/**
 * @file Validation utilities for org data.
 * - Detects structural issues in uploaded flat rows prior to transformation.
 * - Exposes small, focused helpers that are easy to test and reuse.
 */

import { isBlankOrEmpty, normalizeId } from '../utils/helpers.js';

/* ===========================================
   PUBLIC API
=========================================== */

/**
 * Validates basic relationships in flat rows before transforming to org structure.
 * Performs three passes:
 *  1) Duplicates, blanks, self-references, root detection
 *  2) Manager references validity
 *  3) Cycle detection (graph DFS)
 *
 * @param {Array<Object>} rows - Raw rows parsed from Excel (header -> value)
 * @param {string} workerColumn - Column name for Employee/Worker identifier
 * @param {string} managerColumn - Column name for Manager identifier
 * @returns {Array<{type:string,message:string,details:string}>}
 */
export function validateRelations(rows, workerColumn, managerColumn) {
  const errors = [];
  const workerIdMap = new Map();
  const rootNodes = [];

  // Pass 1: duplicates, blanks, self-references, root detection
  rows.forEach((row, index) => {
    const workerId = normalizeId(row[workerColumn]);
    const managerId = normalizeId(row[managerColumn]);

    if (isBlankOrEmpty(workerId)) {
      errors.push({
        type: 'Missing Employee ID',
        message: 'An employee is missing their unique ID, which is required.',
        details: `Row ${index + 2}`
      });
    } else {
      if (workerIdMap.has(workerId)) {
        errors.push({
          type: 'Duplicate Employee ID',
          message: `The employee ID "${workerId}" is used more than once. All IDs must be unique.`,
          details: `Row ${index + 2} is a duplicate of row ${workerIdMap.get(workerId).rowIndex + 2}`
        });
      } else {
        workerIdMap.set(workerId, { row, rowIndex: index });
      }
    }

    // Self-reference
    if (workerId && managerId && workerId === managerId) {
      errors.push({
        type: 'Self-Reference Error',
        message: `Employee "${workerId}" cannot be their own manager.`,
        details: `Row ${index + 2}`
      });
    }

    // Root detection (blank manager)
    if (isBlankOrEmpty(managerId)) {
      rootNodes.push(workerId);
    }
  });

  // Multiple/no root detection
  if (rootNodes.length > 1) {
    errors.push({
      type: 'Multiple CEOs Found',
      message: 'Your organization has more than one person without a manager. There should be only one CEO.',
      details: `Found ${rootNodes.length} top-level employees: ${rootNodes.join(', ')}`
    });
  } else if (rootNodes.length === 0 && rows.length > 0) {
    errors.push({
      type: 'No CEO Found',
      message: 'No employee was found without a manager. Your organization must have one top-level person (CEO).',
      details: 'Please ensure at least one employee has a blank manager field.'
    });
  }

  // Pass 2: manager references exist
  rows.forEach((row, index) => {
    const managerId = normalizeId(row[managerColumn]);
    if (!isBlankOrEmpty(managerId)) {
      if (!workerIdMap.has(managerId)) {
        errors.push({
          type: 'Manager Does Not Exist',
          message: 'A manager listed for an employee does not exist as an employee in the file.',
          details: `Row ${index + 2}: Manager "${managerId}" for Employee "${row[workerColumn]}" is not a valid employee.`
        });
      }
    }
  });

  // Pass 3: cycles
  const cycles = detectCycles(rows, workerColumn, managerColumn);
  for (const cycle of cycles) {
    errors.push({
      type: 'Circular Reference Found',
      message: 'A circular reporting structure (a loop) was detected.',
      details: `Cycle path: ${cycle.join(' → ')} → ${cycle[0]}`
    });
  }

  return errors;
}

/**
 * Detect cycles in a directed graph worker -> manager using DFS.
 */
export function detectCycles(rows, workerColumn, managerColumn) {
  const adjList = new Map();
  const allNodes = new Set();

  // Collect nodes
  rows.forEach(row => {
    const workerId = normalizeId(row[workerColumn]);
    if (workerId) allNodes.add(workerId);
  });

  // Build adjacency: worker -> manager (only if manager exists among workers)
  rows.forEach(row => {
    const workerId = normalizeId(row[workerColumn]);
    const managerId = normalizeId(row[managerColumn]);
    if (workerId && managerId && allNodes.has(managerId)) {
      if (!adjList.has(workerId)) adjList.set(workerId, []);
      adjList.get(workerId).push(managerId);
    }
  });

  const cycles = [];
  const visited = new Set();

  for (const node of allNodes) {
    if (!visited.has(node)) {
      const recursionStack = new Set();
      const path = [];
      findCycleUtil(node, visited, recursionStack, path, adjList, cycles);
    }
  }

  // Deduplicate cycles by sorted signature
  const uniqueCycles = [];
  const seen = new Set();
  cycles.forEach(cycle => {
    const key = [...cycle].sort().join(',');
    if (!seen.has(key)) { seen.add(key); uniqueCycles.push(cycle); }
  });

  return uniqueCycles;
}

/* ===========================================
   INTERNAL HELPERS
=========================================== */

function findCycleUtil(node, visited, stack, path, adjList, cycles) {
  visited.add(node);
  stack.add(node);
  path.push(node);

  const neighbors = adjList.get(node) || [];
  for (const neighbor of neighbors) {
    if (stack.has(neighbor)) {
      const cycle = path.slice(path.indexOf(neighbor));
      cycles.push(cycle);
    } else if (!visited.has(neighbor)) {
      findCycleUtil(neighbor, visited, stack, path, adjList, cycles);
    }
  }

  stack.delete(node);
  path.pop();
}


