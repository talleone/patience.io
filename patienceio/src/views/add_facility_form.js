/**
 * Copyright 2017 Intel Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ----------------------------------------------------------------------------
 */

const m = require('mithril')

const api = require('../services/api')
const payloads = require('../services/payloads')
const transactions = require('../services/transactions')
const parsing = require('../services/parsing')
const {MultiSelect} = require('../components/forms')
const layout = require('../components/layout')

/**
 * Possible selection options 
 */
const authorizableProperties = [
  ['administration', 'Administration'],
  ['plants', 'Plants'],
  ['packages', 'Packages'],
  ['transfers', 'Transfers'],
  ['sales', 'Sales'],
  ['reports', 'Reports'],
  ['financials', 'Financials']
]

/**
 * The Form for tracking a new facility.
 */
const AddFacilityForm = {
  oninit (vnode) {
    // Initialize the empty reporters fields
    vnode.state.reporters = [
      {
        reporterKey: '',
        properties: []
      }
    ]
    api.get('agents')
      .then(agents => {
        const publicKey = api.getPublicKey()
        vnode.state.agents = agents.filter(agent => agent.key !== publicKey)
      })
  },

  view (vnode) {
    return m('.facility_form',
             m('form', {
               onsubmit: (e) => {
                 e.preventDefault()
                 _handleSubmit(vnode.attrs.signingKey, vnode.state)
               }
             },
             m('legend', 'Add New Facility'),
             _formGroup('License Number', m('input.form-control', {
               type: 'text',
               oninput: m.withAttr('value', (value) => {
                 vnode.state.facilityLicenseNumber = value
               }),
               value: vnode.state.facilityLicenseNumber
             })),
             // DROPDOWN
             _formGroup('License Type', m('input.form-control', {
               type: 'text',
               oninput: m.withAttr('value', (value) => {
                 vnode.state.facilityLicenseType = value
               }),
               value: vnode.state.facilityLicenseType
             })),
             _formGroup('Business Name', m('input.form-control', {
               type: 'text',
               oninput: m.withAttr('value', (value) => {
                 vnode.state.facilityLegalName = value
               }),
               value: vnode.state.facilityLegalName
             })),
             // CHECKBOX
             _formGroup('Facility Manager', m('input.form-control', {
               type: 'text',
               oninput: m.withAttr('value', (value) => {
                 vnode.state.facilityManager = value
               }),
               value: vnode.state.facilityManager
             })),
            //End form fields for facility
            layout.row('legend', 'Facility Address in lat,long'[
               _formGroup('Latitude', m('input.form-control', {
                 type: 'number',
                 step: 'any',
                 min: -90,
                 max: 90,
                 oninput: m.withAttr('value', (value) => {
                   vnode.state.latitude = value
                 }),
                 value: vnode.state.latitude
               })),
               _formGroup('Longitude', m('input.form-control', {
                 type: 'number',
                 step: 'any',
                 min: -180,
                 max: 180,
                 oninput: m.withAttr('value', (value) => {
                   vnode.state.longitude = value
                 }),
                 value: vnode.state.longitude
               }))
             ]),

             m('.reporters.form-group',
               m('label', 'Authorize Reporters'),

               vnode.state.reporters.map((reporter, i) =>
                 m('.row.mb-2',
                   m('.col-sm-8',
                     m('input.form-control', {
                       type: 'text',
                       placeholder: 'Add reporter by name or public key...',
                       oninput: m.withAttr('value', (value) => {
                         // clear any previously matched values
                         vnode.state.reporters[i].reporterKey = null
                         const reporter = vnode.state.agents.find(agent => {
                           return agent.name === value || agent.key === value
                         })
                         if (reporter) {
                           vnode.state.reporters[i].reporterKey = reporter.key
                         }
                       }),
                       onblur: () => _updateReporters(vnode, i)
                     })),

                   m('.col-sm-4',
                     m(MultiSelect, {
                       label: 'Select Fields',
                       options: authorizableProperties,
                       selected: reporter.properties,
                       onchange: (selection) => {
                         vnode.state.reporters[i].properties = selection
                       }
                     }))))),

             m('.row.justify-content-end.align-items-end',
               m('col-2',
                 m('button.btn.btn-primary',
                   'Create Record')))))
  }
}

/**
 * Update the reporter's values after a change occurs in the name of the
 * reporter at the given reporterIndex. If it is empty, and not the only
 * reporter in the list, remove it.  If it is not empty and the last item
 * in the list, add a new, empty reporter to the end of the list.
 */
const _updateReporters = (vnode, reporterIndex) => {
  let reporterInfo = vnode.state.reporters[reporterIndex]
  let lastIdx = vnode.state.reporters.length - 1
  if (!reporterInfo.reporterKey && reporterIndex !== lastIdx) {
    vnode.state.reporters.splice(reporterIndex, 1)
  } else if (reporterInfo.reporterKey && reporterIndex === lastIdx) {
    vnode.state.reporters.push({
      reporterKey: '',
      properties: []
    })
  }
}

/**
 * Handle the form submission.
 *
 * Extract the appropriate values to pass to the create record transaction.
 */
const _handleSubmit = (signingKey, state) => {
  const recordPayload = payloads.createRecord({
    recordId: state.facilityLicenseNumber,
    recordType: 'facility',
    properties: [
      {
        name: 'facilityLicenseType',
        stringValue: state.facilityLicenseType,
        dataType: payloads.createRecord.enum.STRING
      },
      {
        name: 'facilityLegalName',
        stringValue: state.facilityLegalName,
        dataType: payloads.createRecord.enum.STRING
      },
      {
        name: 'facilityManager',
        stringValue: state.facilityManager,
        dataType: payloads.createRecord.enum.STRING
      },
      {
        name: 'location',
        locationValue: {
          latitude: parsing.toInt(state.latitude),
          longitude: parsing.toInt(state.longitude)
        },
        dataType: payloads.createRecord.enum.LOCATION
      }
    ]
  })

  const reporterPayloads = state.reporters
    .filter((reporter) => !!reporter.reporterKey)
    .map((reporter) => payloads.createProposal({
      recordId: state.facilityLicenseNumber,
      receivingAgent: reporter.reporterKey,
      role: payloads.createProposal.enum.REPORTER,
      properties: reporter.properties
    }))

  transactions.submit([recordPayload].concat(reporterPayloads), true)
    .then(() => m.route.set(`/facility/${state.facilityLicenseNumber}`))
}

/**
 * Create a form group (this is a styled form-group with a label).
 */
const _formGroup = (label, formEl) =>
  m('.form-group',
    m('label', label),
    formEl)

module.exports = AddFacilityForm